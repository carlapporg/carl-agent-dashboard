"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { sendUpdateAction } from "@/features/tasks/actions/task-actions";
import { useOps } from "@/features/ops/ops-provider";
import { CHAT_TEMPLATES } from "@/features/tasks/lib/workflow";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils/cn";
import type { TimelineEvent, TimelineEventKind } from "@/types/message";

export type TaskChatThreadHandle = {
  prefills: (text: string) => void;
};

type TaskChatThreadProps = {
  taskId: string;
  timeline: TimelineEvent[];
  quickActions?: string[];
  showTemplates?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
  title?: string;
  subtitle?: string;
  clientLabel?: string;
  /** Full-height column (task workspace). Turn off for embedded panels. */
  fillHeight?: boolean;
};

type ChatItem = TimelineEvent & {
  delivery?: "sending" | "failed";
};

type MessageTone = "agent" | "client" | "system" | "important";

type ThreadBlock =
  | { type: "day"; key: string; label: string }
  | { type: "unread"; key: string }
  | { type: "system"; key: string; event: ChatItem }
  | { type: "important"; key: string; event: ChatItem }
  | { type: "cluster"; key: string; role: "agent" | "client"; items: ChatItem[] };

const GROUP_MS = 5 * 60 * 1000;
const IMPORTANT_KINDS: TimelineEventKind[] = [
  "approval_requested",
  "approval_result",
  "receipt_uploaded",
];
const IMPORTANT_BODY =
  /payment|approved|declined|booking|receipt|authori[sz]ation|expired/i;

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return calendarDay(date);
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(value) === calendarDay(today)) return "Today";
  if (dayKey(value) === calendarDay(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isVisibleInThread(event: TimelineEvent): boolean {
  return (
    event.kind === "agent_message" ||
    event.kind === "customer_message" ||
    event.kind === "status_change" ||
    event.kind === "approval_requested" ||
    event.kind === "approval_result" ||
    event.kind === "receipt_uploaded" ||
    event.kind === "system" ||
    event.visibleToCustomer
  );
}

function messageTone(event: ChatItem): MessageTone {
  if (event.kind === "agent_message") return "agent";
  if (event.kind === "customer_message") return "client";
  if (
    IMPORTANT_KINDS.includes(event.kind) ||
    (event.kind === "system" && IMPORTANT_BODY.test(event.body))
  ) {
    return "important";
  }
  return "system";
}

function importantLabel(event: ChatItem): string {
  if (event.kind === "approval_requested") return "Payment approval";
  if (event.kind === "approval_result") return "Payment update";
  if (event.kind === "receipt_uploaded") return "Receipt";
  if (/declin|fail|expir|cancel/i.test(event.body)) return "Needs attention";
  if (/book/i.test(event.body)) return "Booking";
  return "Important";
}

function importantTone(event: ChatItem): "ok" | "warn" | "bad" {
  if (/declin|fail|expir|cancel/i.test(event.body)) return "bad";
  if (
    event.kind === "approval_result" ||
    /approved|confirm|receipt/i.test(event.body)
  ) {
    return "ok";
  }
  return "warn";
}

function mergeThread(server: TimelineEvent[], extras: ChatItem[]): ChatItem[] {
  const ids = new Set(server.map((item) => item.id));
  const extra = extras.filter((item) => !ids.has(item.id));
  return [...server, ...extra].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function buildBlocks(
  thread: ChatItem[],
  unreadFromId: string | null,
): ThreadBlock[] {
  const blocks: ThreadBlock[] = [];
  let lastDay = "";
  let i = 0;
  while (i < thread.length) {
    const event = thread[i];
    const day = dayKey(event.createdAt);
    if (day && day !== lastDay) {
      blocks.push({ type: "day", key: `day-${day}`, label: dayLabel(event.createdAt) });
      lastDay = day;
    }
    if (unreadFromId && event.id === unreadFromId) {
      blocks.push({ type: "unread", key: "unread" });
    }
    const tone = messageTone(event);
    if (tone === "system" || tone === "important") {
      blocks.push({ type: tone, key: event.id, event });
      i += 1;
      continue;
    }
    const items = [event];
    while (i + items.length < thread.length) {
      const next = thread[i + items.length];
      if (unreadFromId && next.id === unreadFromId) break;
      if (messageTone(next) !== tone) break;
      if (dayKey(next.createdAt) !== day) break;
      const prevTime = new Date(items[items.length - 1].createdAt).getTime();
      if (new Date(next.createdAt).getTime() - prevTime > GROUP_MS) break;
      items.push(next);
    }
    blocks.push({ type: "cluster", key: items[0].id, role: tone, items });
    i += items.length;
  }
  return blocks;
}

function resizeComposer(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M4.4 12.2 19 5.5l-5.2 14.2-2.1-5.6-5.3-1.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ChatBubble = memo(function ChatBubble({
  event,
  role,
  grouped,
  onRetry,
}: {
  event: ChatItem;
  role: "agent" | "client";
  grouped: boolean;
  onRetry?: (event: ChatItem) => void;
}) {
  const fromAgent = role === "agent";
  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 40px" }}
      className={cn(
        "w-fit max-w-[min(78%,22rem)]",
        fromAgent ? "ml-auto" : "mr-auto",
      )}
    >
      <div
        className={cn(
          "px-2.5 py-1.5 text-[13px] leading-snug",
          fromAgent
            ? "rounded-2xl rounded-br-md bg-accent text-accent-foreground"
            : "rounded-2xl rounded-bl-md bg-[#eef0f3] text-foreground",
          grouped && fromAgent && "rounded-tr-md",
          grouped && !fromAgent && "rounded-tl-md",
          event.delivery === "failed" && "bg-red-600",
        )}
      >
        <p className="whitespace-pre-wrap wrap-break-word">{event.body}</p>
        {event.delivery === "sending" || event.delivery === "failed" ? (
          <p
            className={cn(
              "mt-0.5 text-[10px]",
              fromAgent ? "text-white/75" : "text-muted",
            )}
          >
            {event.delivery === "sending" ? "Sending…" : "Couldn’t send"}
            {event.delivery === "failed" && onRetry ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => onRetry(event)}
                >
                  Retry
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
});

const SystemLine = memo(function SystemLine({ event }: { event: ChatItem }) {
  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 28px" }}
      className="flex items-center gap-2 py-1"
    >
      <span className="h-px flex-1 bg-border" />
      <p className="max-w-[85%] text-center text-[11px] leading-snug text-muted">
        {event.body}
        {formatClock(event.createdAt) ? (
          <span className="text-muted-dim"> · {formatClock(event.createdAt)}</span>
        ) : null}
      </p>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
});

const ImportantCard = memo(function ImportantCard({
  event,
}: {
  event: ChatItem;
}) {
  const tone = importantTone(event);
  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 48px" }}
      className={cn(
        "mx-auto w-full max-w-88 rounded-md border-l-[3px] px-2.5 py-1.5",
        tone === "ok" && "border-l-emerald-500 bg-emerald-50",
        tone === "warn" && "border-l-amber-500 bg-amber-50",
        tone === "bad" && "border-l-red-500 bg-red-50",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          tone === "ok" && "text-emerald-800",
          tone === "warn" && "text-amber-800",
          tone === "bad" && "text-red-800",
        )}
      >
        {importantLabel(event)}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[12px] leading-snug",
          tone === "ok" && "text-emerald-950",
          tone === "warn" && "text-amber-950",
          tone === "bad" && "text-red-950",
        )}
      >
        {event.body}
      </p>
      {formatClock(event.createdAt) ? (
        <p className="mt-0.5 text-[10px] text-muted">{formatClock(event.createdAt)}</p>
      ) : null}
    </div>
  );
});

export const TaskChatThread = forwardRef<
  TaskChatThreadHandle,
  TaskChatThreadProps
>(function TaskChatThread(
  {
    taskId,
    timeline,
    quickActions = [],
    showTemplates = true,
    disabled = false,
    disabledHint,
    className,
    title = "Conversation",
    subtitle,
    clientLabel = "Client",
    fillHeight = true,
  },
  ref,
) {
  const { toast } = useToast();
  const ops = useOps();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [extras, setExtras] = useState<ChatItem[]>([]);
  const [newBanner, setNewBanner] = useState(false);
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const applyDraft = useCallback((text: string) => {
    setDraft(text);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 900);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      resizeComposer(inputRef.current);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    prefills: (text: string) => applyDraft(text),
  }));

  useEffect(() => {
    setExtras([]);
    setUnreadFromId(null);
    setNewBanner(false);
    setPinnedToBottom(true);
    pinnedRef.current = true;
  }, [taskId]);

  const liveChat = ops?.liveChat ?? null;
  useEffect(() => {
    if (!liveChat || liveChat.taskId !== taskId) return;
    if (liveChat.sender !== "USER") return;
    setExtras((prev) => {
      if (
        prev.some(
          (item) =>
            item.body === liveChat.content && item.kind === "customer_message",
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `live-${liveChat.at}`,
          taskId,
          kind: "customer_message",
          body: liveChat.content,
          createdAt: new Date(liveChat.at).toISOString(),
          visibleToCustomer: true,
        },
      ];
    });
  }, [liveChat, taskId]);

  const thread = useMemo(
    () => mergeThread(timeline, extras).filter(isVisibleInThread),
    [extras, timeline],
  );
  const blocks = useMemo(
    () => buildBlocks(thread, unreadFromId),
    [thread, unreadFromId],
  );
  const prevCount = useRef(thread.length);

  const scrollToBottom = useCallback((smooth = false) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (thread.length <= prevCount.current) {
      prevCount.current = thread.length;
      return;
    }
    const last = thread[thread.length - 1];
    const incomingClient = last?.kind === "customer_message";
    if (incomingClient && !pinnedRef.current) {
      setNewBanner(true);
      setUnreadFromId((current) => current ?? last.id);
    } else {
      scrollToBottom();
    }
    prevCount.current = thread.length;
  }, [scrollToBottom, thread]);

  useEffect(() => {
    if (!newBanner) return;
    const id = window.setTimeout(() => setNewBanner(false), 5000);
    return () => window.clearTimeout(id);
  }, [newBanner]);

  useEffect(() => {
    resizeComposer(inputRef.current);
  }, [draft]);

  const sendNow = useCallback(
    async (text: string, replaceId?: string) => {
      const optimisticId = replaceId ?? `opt-${Date.now()}`;
      if (!replaceId) {
        setExtras((prev) => [
          ...prev,
          {
            id: optimisticId,
            taskId,
            kind: "agent_message",
            body: text,
            createdAt: new Date().toISOString(),
            visibleToCustomer: true,
            delivery: "sending",
          },
        ]);
        setDraft("");
        formRef.current?.reset();
        setError(null);
        pinnedRef.current = true;
        setPinnedToBottom(true);
      } else {
        setExtras((prev) =>
          prev.map((item) =>
            item.id === optimisticId ? { ...item, delivery: "sending" } : item,
          ),
        );
      }
      const result = await sendUpdateAction(taskId, text);
      if (!result.ok) {
        setExtras((prev) =>
          prev.map((item) =>
            item.id === optimisticId ? { ...item, delivery: "failed" } : item,
          ),
        );
        setError(result.message);
        toast(result.message, "error");
        return;
      }
      setExtras((prev) =>
        prev.map((item) =>
          item.id === optimisticId ? { ...result.event } : item,
        ),
      );
    },
    [taskId, toast],
  );

  const onRetry = useCallback(
    (event: ChatItem) => {
      void sendNow(event.body, event.id);
    },
    [sendNow],
  );

  function onScrollerScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nearBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
    pinnedRef.current = nearBottom;
    setPinnedToBottom(nearBottom);
    if (nearBottom) {
      setUnreadFromId(null);
      setNewBanner(false);
    }
  }

  const showQuickBar = (showTemplates || quickActions.length > 0) && !disabled;

  return (
    <section
      id="panel-chat"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="truncate text-[11px] text-muted">
            {subtitle ?? `With ${clientLabel}`}
          </p>
        </div>
        {newBanner ? (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            New
          </span>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={onScrollerScroll}
          className="h-full overflow-y-auto px-3 py-2"
        >
          {thread.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center">
              <p className="text-sm text-muted">
                No messages yet. Say hello when you’re ready.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {blocks.map((block) => {
                if (block.type === "day") {
                  return (
                    <div
                      key={block.key}
                      className="sticky top-0 z-10 flex justify-center py-1"
                    >
                      <span className="rounded-full border border-border bg-surface/95 px-2 py-0.5 text-[10px] font-medium text-muted shadow-sm">
                        {block.label}
                      </span>
                    </div>
                  );
                }
                if (block.type === "unread") {
                  return (
                    <div
                      key={block.key}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <span className="h-px flex-1 bg-accent/50" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                        New messages
                      </span>
                      <span className="h-px flex-1 bg-accent/50" />
                    </div>
                  );
                }
                if (block.type === "system") {
                  return <SystemLine key={block.key} event={block.event} />;
                }
                if (block.type === "important") {
                  return <ImportantCard key={block.key} event={block.event} />;
                }
                const first = block.items[0];
                const fromAgent = block.role === "agent";
                return (
                  <div
                    key={block.key}
                    className={cn(
                      "flex flex-col gap-0.5",
                      fromAgent ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-baseline gap-1.5 px-0.5",
                        fromAgent && "flex-row-reverse",
                      )}
                    >
                      <span className="text-[11px] font-semibold text-foreground-soft">
                        {fromAgent ? "You" : clientLabel}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-dim">
                        {formatClock(first.createdAt)}
                      </span>
                    </div>
                    {block.items.map((event, index) => (
                      <ChatBubble
                        key={event.id}
                        event={event}
                        role={block.role}
                        grouped={index > 0}
                        onRetry={event.delivery === "failed" ? onRetry : undefined}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!pinnedToBottom ? (
          <button
            type="button"
            onClick={() => {
              pinnedRef.current = true;
              setPinnedToBottom(true);
              setUnreadFromId(null);
              setNewBanner(false);
              scrollToBottom(true);
            }}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-foreground-soft shadow-(--shadow-card) hover:bg-surface-hover"
          >
            {newBanner ? "New messages" : "Jump to latest"}
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-surface">
        {showQuickBar ? (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-1.5 scrollbar-none">
            {showTemplates
              ? CHAT_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyDraft(t)}
                    className="shrink-0 rounded-full border border-border bg-[#f8fafc] px-2.5 py-0.5 text-[11px] text-foreground-soft hover:border-accent/40 hover:text-accent"
                    title={t}
                  >
                    {t.length > 28 ? `${t.slice(0, 26)}…` : t}
                  </button>
                ))
              : null}
            {quickActions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => applyDraft(`Could you confirm: ${q}?`)}
                className="shrink-0 rounded-full border border-dashed border-border bg-surface px-2.5 py-0.5 text-[11px] text-muted hover:border-accent/40 hover:text-accent"
              >
                {q.length > 24 ? `${q.slice(0, 22)}…` : q}
              </button>
            ))}
          </div>
        ) : null}

        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text || disabled) return;
            void sendNow(text);
          }}
          className="px-3 pb-2.5 pt-1"
        >
          {disabledHint ? (
            <p className="mb-1.5 text-[11px] text-muted">{disabledHint}</p>
          ) : null}
          {error ? (
            <p className="mb-1.5 text-[11px] font-medium text-red-700">{error}</p>
          ) : null}
          <div
            className={cn(
              "flex items-end gap-2 rounded-lg border bg-surface px-2.5 py-1.5",
              flash ? "border-accent ring-2 ring-accent/20" : "border-border",
              disabled && "bg-[#f8fafc]",
            )}
          >
            <textarea
              ref={inputRef}
              name="body"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                const text = draft.trim();
                if (!text || disabled) return;
                void sendNow(text);
              }}
              placeholder={disabled ? "Messaging is paused" : "Write a message…"}
              rows={1}
              disabled={disabled}
              className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm leading-snug text-foreground outline-none placeholder:text-muted-dim"
            />
            <button
              type="submit"
              disabled={disabled || !draft.trim()}
              aria-label="Send"
              className="mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
});
