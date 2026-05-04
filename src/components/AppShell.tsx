import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, BarChart3, History, LogOut, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Conv = { id: string; title: string; updated_at: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [convs, setConvs] = useState<Conv[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const loadConvs = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    setConvs(data ?? []);
  };

  useEffect(() => {
    if (user) {
      loadConvs();
      const ch = supabase
        .channel("conv-list")
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, loadConvs)
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, [user]);

  const newChat = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New chat" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate({ to: "/chat", search: { c: data.id } });
    setOpen(false);
  };

  const deleteConv = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    if (pathname === "/chat") navigate({ to: "/chat", search: { c: undefined } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const navItems = [
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    { to: "/history", icon: History, label: "History" },
    { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
  ];

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">Adaptive AI</p>
            <p className="text-xs text-muted-foreground leading-tight">Learning from you</p>
          </div>
        </div>

        <div className="px-3">
          <Button onClick={newChat} className="w-full justify-start rounded-xl glow">
            <Plus className="mr-2 h-4 w-4" /> New chat
          </Button>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          <div className="space-y-1">
            {convs.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">No chats yet</p>
            )}
            {convs.map((c) => {
              const active = pathname === "/chat" && typeof window !== "undefined" && window.location.search.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pr-1 transition",
                    active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
                  )}
                >
                  <Link
                    to="/chat"
                    search={{ c: c.id }}
                    onClick={() => setOpen(false)}
                    className="flex-1 truncate px-3 py-2 text-sm text-sidebar-foreground/90"
                  >
                    {c.title}
                  </Link>
                  <button
                    onClick={() => deleteConv(c.id)}
                    className="rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 truncate text-sm">{user.email}</div>
            <button
              onClick={signOut}
              className="rounded p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 hover:bg-accent"
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-semibold">Adaptive AI</span>
      </div>

      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
