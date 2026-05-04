import { useState } from "react";
import { ThumbsUp, ThumbsDown, Star, Pencil, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FeedbackState = {
  liked: boolean | null;
  rating: number | null;
  edited_content: string | null;
};

export function MessageBubble({
  role,
  content,
  messageId,
  userId,
  feedback,
  isStreaming,
  onFeedbackChange,
}: {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  userId?: string;
  feedback?: FeedbackState;
  isStreaming?: boolean;
  onFeedbackChange?: (fb: FeedbackState) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(feedback?.edited_content ?? content);
  const [saving, setSaving] = useState(false);

  const upsertFeedback = async (patch: Partial<FeedbackState>) => {
    if (!messageId || !userId) return;
    const next = {
      liked: feedback?.liked ?? null,
      rating: feedback?.rating ?? null,
      edited_content: feedback?.edited_content ?? null,
      ...patch,
    };
    const { error } = await supabase
      .from("feedback")
      .upsert(
        { message_id: messageId, user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: "message_id" },
      );
    if (error) return toast.error(error.message);
    onFeedbackChange?.(next);
  };

  if (role === "user") {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow-md">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <div
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-md glass px-4 py-3">
          {content ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
            </div>
          )}
          {isStreaming && content && <Loader2 className="mt-2 inline h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {messageId && !isStreaming && (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            <button
              onClick={() => upsertFeedback({ liked: feedback?.liked === true ? null : true })}
              className={cn(
                "rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground",
                feedback?.liked === true && "bg-primary/20 text-primary",
              )}
              aria-label="Like"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => upsertFeedback({ liked: feedback?.liked === false ? null : false })}
              className={cn(
                "rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground",
                feedback?.liked === false && "bg-destructive/20 text-destructive",
              )}
              aria-label="Dislike"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => upsertFeedback({ rating: feedback?.rating === n ? null : n })}
                className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                aria-label={`Rate ${n}`}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    (feedback?.rating ?? 0) >= n && "fill-primary text-primary",
                  )}
                />
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={() => {
                setEditText(feedback?.edited_content ?? content);
                setEditOpen(true);
              }}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground",
                feedback?.edited_content && "text-primary",
              )}
            >
              <Pencil className="h-3 w-3" />
              {feedback?.edited_content ? "Edited" : "Edit answer"}
            </button>
          </div>
        )}

        {feedback?.edited_content && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">Your improved answer</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.edited_content}</p>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Improve this answer</DialogTitle>
            <DialogDescription>
              Edit the AI's response to teach the assistant a better answer.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await upsertFeedback({ edited_content: editText.trim() || null });
                setSaving(false);
                setEditOpen(false);
                toast.success("Improved answer saved");
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
