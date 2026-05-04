import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MessageBubble, type FeedbackState } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: FeedbackState;
};

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/auth",
      });
    }
  },
  component: ChatPage,
});

function ChatPage() {
  return (
    <AppShell>
      <Chat />
    </AppShell>
  );
}

function Chat() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const conversationId = search.c;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setStreamingContent("");
    if (!conversationId || !user) return;
    (async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id,role,content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      const ids = (msgs ?? []).map((m) => m.id);
      let fbMap: Record<string, FeedbackState> = {};
      if (ids.length) {
        const { data: fbs } = await supabase
          .from("feedback")
          .select("message_id,liked,rating,edited_content")
          .in("message_id", ids);
        fbMap = Object.fromEntries(
          (fbs ?? []).map((f) => [
            f.message_id,
            { liked: f.liked, rating: f.rating, edited_content: f.edited_content },
          ]),
        );
      }
      setMessages(
        (msgs ?? []).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          feedback: fbMap[m.id],
        })),
      );
    })();
  }, [conversationId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const send = async () => {
    const text = input.trim();
    const parsed = z.string().min(1, "Message cannot be empty").max(4000).safeParse(text);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user || sending) return;

    setSending(true);
    setInput("");

    try {
      // Ensure conversation exists
      let convId = conversationId;
      if (!convId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: text.slice(0, 60) })
          .select()
          .single();
        if (error) throw error;
        convId = data.id;
        navigate({ search: { c: convId }, replace: true });
      } else {
        // Update title if first message
        if (messages.length === 0) {
          await supabase.from("conversations").update({ title: text.slice(0, 60) }).eq("id", convId);
        }
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      }

      // Insert user message
      const { data: userMsg, error: umErr } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "user", content: text })
        .select()
        .single();
      if (umErr) throw umErr;

      const newMessages: Message[] = [
        ...messages,
        { id: userMsg.id, role: "user", content: text },
      ];
      setMessages(newMessages);

      // Stream AI
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const { data: sessionData } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages }),
        },
      );

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Rate limit exceeded. Try again shortly.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("AI request failed");
        setSending(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setStreamingContent(assistantText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save assistant message
      const { data: aMsg, error: aErr } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "assistant", content: assistantText })
        .select()
        .single();
      if (aErr) throw aErr;

      setMessages((prev) => [...prev, { id: aMsg.id, role: "assistant", content: assistantText }]);
      setStreamingContent("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const empty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex h-screen flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {empty && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
              <div
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl glow"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                How can I <span className="gradient-text">help</span> today?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask anything. Rate the answers. Edit them to make me smarter.
              </p>
              <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {[
                  "Explain quantum computing simply",
                  "Write a haiku about the ocean",
                  "Plan a 3-day trip to Tokyo",
                  "Debug this: useEffect runs twice",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="rounded-xl glass px-4 py-3 text-left text-sm text-muted-foreground transition hover:text-foreground hover:-translate-y-0.5"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              messageId={m.id}
              userId={user?.id}
              feedback={m.feedback}
              onFeedbackChange={(fb) =>
                setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, feedback: fb } : x)))
              }
            />
          ))}

          {sending && (
            <MessageBubble role="assistant" content={streamingContent} isStreaming />
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl glass p-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Message Adaptive AI…"
              rows={1}
              className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl glow"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Adaptive AI can make mistakes — your feedback teaches it.
          </p>
        </div>
      </div>
    </div>
  );
}
