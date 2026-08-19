"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { sendUpdateAction } from "@/features/tasks/actions/task-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { TimelineEvent } from "@/types/message";

type AskQuestionPanelProps = {
  taskId: string;
  timeline: TimelineEvent[];
  suggestedQuestions?: string[];
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AskQuestionPanel({
  taskId,
  timeline,
  suggestedQuestions = [],
}: AskQuestionPanelProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const thread = timeline.filter(
    (e) =>
      e.kind === "agent_message" ||
      e.kind === "customer_message" ||
      e.visibleToCustomer,
  );

  return (
    <div className="flex h-full min-h-72 flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Questions</h2>
        <p className="mt-0.5 text-sm text-muted">
          Ask the customer what you need — keep it short and clear.
        </p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {thread.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-[#f8fafc] px-3 py-6 text-center">
            <p className="text-sm font-medium text-foreground-soft">
              No questions yet
            </p>
            <p className="mt-1 text-sm text-muted">
              Use the bar below to ask the customer.
            </p>
          </div>
        ) : (
          thread.map((event) => {
            const fromAgent = event.kind === "agent_message";
            return (
              <div
                key={event.id}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
                  fromAgent
                    ? "ml-auto bg-accent text-accent-foreground"
                    : "mr-auto border border-border bg-surface-hover text-foreground-soft",
                )}
              >
                <p>{event.body}</p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    fromAgent ? "text-white/75" : "text-muted-dim",
                  )}
                >
                  {event.authorName ? `${event.authorName} · ` : ""}
                  {formatTime(event.createdAt)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {suggestedQuestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-[#f8fafc] px-4 py-2.5">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Quick ask
          </span>
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setDraft(`Could you confirm: ${q}?`)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm text-foreground-soft transition-colors hover:border-accent/40 hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={async (formData) => {
          setPending(true);
          try {
            await sendUpdateAction(taskId, formData);
            setDraft("");
            formRef.current?.reset();
            router.refresh();
          } finally {
            setPending(false);
          }
        }}
        className="border-t border-border bg-surface p-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            required
            className="min-h-10 flex-1 resize-none"
            rows={2}
            disabled={pending}
          />
          <Button type="submit" className="shrink-0" disabled={pending}>
            {pending ? "Sending…" : "Send question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
