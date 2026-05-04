import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, MessageSquare, ThumbsUp, BarChart3, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat", search: { c: undefined } });
  }, [user, loading, navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* nav */}
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Adaptive AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center animate-fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary glow" />sai likitha
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
          The AI that <span className="gradient-text">learns from you</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Ask anything. Rate every answer. Edit responses to teach the AI. Learning from you, improving for everyone.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full glow">
            <Link to="/auth">
              Start chatting <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-4 md:grid-cols-3">
          {[
            { icon: MessageSquare, title: "Natural chat", desc: "Conversational, context-aware AI replies." },
            { icon: ThumbsUp, title: "Built-in feedback", desc: "Like, dislike, rate, and edit any answer." },
            { icon: BarChart3, title: "Insights", desc: "Dashboards reveal trends in answer quality." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl glass p-6 text-left transition hover:-translate-y-1">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
