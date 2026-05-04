
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "Conv select own" on public.conversations for select using (auth.uid() = user_id);
create policy "Conv insert own" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Conv update own" on public.conversations for update using (auth.uid() = user_id);
create policy "Conv delete own" on public.conversations for delete using (auth.uid() = user_id);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Msg select own" on public.messages for select using (auth.uid() = user_id);
create policy "Msg insert own" on public.messages for insert with check (auth.uid() = user_id);
create policy "Msg update own" on public.messages for update using (auth.uid() = user_id);
create policy "Msg delete own" on public.messages for delete using (auth.uid() = user_id);
create index on public.messages (conversation_id, created_at);

-- Feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  liked boolean,
  rating int check (rating between 1 and 5),
  edited_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "Fb select own" on public.feedback for select using (auth.uid() = user_id);
create policy "Fb insert own" on public.feedback for insert with check (auth.uid() = user_id);
create policy "Fb update own" on public.feedback for update using (auth.uid() = user_id);
create policy "Fb delete own" on public.feedback for delete using (auth.uid() = user_id);
