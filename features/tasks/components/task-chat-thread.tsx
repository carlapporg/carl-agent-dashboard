"use client";

import { useRouter } from "next/navigation";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { sendUpdateAction } from "@/features/tasks/actions/task-actions";
import { CHAT_TEMPLATES } from "@/features/tasks/lib/workflow";
import { useTaskChatSocket } from "@/hooks/use-task-chat-socket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { TimelineEvent } from "@/types/message";

export type TaskChatThreadHandle = {
  prefills: (text: string) => void;
};

type TaskChatThreadProps = {
  taskId: string;
  timeline: TimelineEvent[];
  quickActions?: string[];
  showTemplates?: boolean;
  className?: string;
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

function speakerLabel(event: TimelineEvent): "You" | "Client" | "System" {
  if (event.kind === "agent_message") return "You";
  if (event.kind === "customer_message") return "Client";
  return "System";
}

export const TaskChatThread = forwardRef<
  TaskChatThreadHandle,
  TaskChatThreadProps
>(function TaskChatThread(
  {
    taskId,
    timeline,
    quickActions = [],
    showTemplates = true,
    className,
  },
  ref,
) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { configured: wsLive } = useTaskChatSocket({ taskId, enabled: true });

  function applyDraft(text: string) {
    setDraft(text);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1200);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useImperativeHandle(ref, () => ({
    prefills: (text: string) => applyDraft(text),
  }));

  const thread = timeline.filter(
    (e) =>
      e.kind === "agent_message" ||
      e.kind === "customer_message" ||
      e.kind === "status_change" ||
      e.kind === "approval_requested" ||
      e.kind === "approval_result" ||
      e.kind === "system" ||
      e.visibleToCustomer,
  );

  return (
    <section
      id="panel-chat"
      className={cn(
        "flex h-full min-h-[28rem] scroll-mt-24 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)] lg:min-h-0 lg:h-[calc(100dvh-5.5rem)]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
        <p className="mt-0.5 text-xs text-muted">
          You / Client / System
          {wsLive ? " · live" : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {thread.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-[#f8fafc] px-3 py-8 text-center">
            <p className="text-sm text-muted">
              No messages yet. Updates appear here automatically.
            </p>
          </div>
        ) : (
          thread.map((event) => {
            const who = speakerLabel(event);
            const fromAgent = who === "You";
            const fromSystem = who === "System";
            return (
              <div
                key={event.id}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
                  fromAgent && "ml-auto bg-accent text-accent-foreground",
                  fromSystem &&
                    "mx-auto w-full max-w-none border border-border bg-[#f8fafc] text-foreground-soft",
                  !fromAgent &&
                    !fromSystem &&
                    "mr-auto border border-border bg-surface-hover text-foreground-soft",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    fromAgent ? "text-white/80" : "text-muted",
                  )}
                >
                  {who}
                </p>
                <p className="mt-0.5">{event.body}</p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    fromAgent ? "text-white/70" : "text-muted-dim",
                  )}
                >
                  {formatTime(event.createdAt)}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-[#f8fafc]">
        {(showTemplates || quickActions.length > 0) && (
          <div className="space-y-2 border-b border-border px-3 py-2.5">
            {showTemplates ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Insert template
                </span>
                {CHAT_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyDraft(t)}
                    className="max-w-full truncate rounded-full border border-border bg-surface px-2.5 py-1 text-left text-xs text-foreground-soft transition-colors hover:border-accent/40 hover:text-accent"
                    title={t}
                  >
                    {t.length > 42 ? `${t.slice(0, 40)}…` : t}
                  </button>
                ))}
              </div>
            ) : null}
            {quickActions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Ask client
                </span>
                {quickActions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => applyDraft(`Could you confirm: ${q}?`)}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-left text-xs text-foreground-soft transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

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
          className="p-3"
        >
          {flash ? (
            <p className="mb-2 text-xs font-medium text-accent">
              Template added — review and send below.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              ref={inputRef}
              name="body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a task-related message…"
              required
              className={cn(
                "min-h-12 flex-1 resize-none",
                flash && "ring-2 ring-accent/40",
              )}
              rows={2}
              disabled={pending}
            />
            <Button type="submit" className="shrink-0" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
});
