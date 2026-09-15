"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminChatAction,
  listAdminChatMessagesAction,
  markAdminChatReadAction,
  openAdminChatAction,
  sendAdminChatMessageAction,
} from "@/features/admin-chat/actions";
import { useAdminChatSocket } from "@/features/admin-chat/hooks/use-admin-chat-socket";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type {
  AdminChatConversation,
  AdminChatMessage,
} from "@/types/admin-chat";

const MAX_CONTENT = 4000;
const PAGE_LIMIT = 50;
const ADMIN_LABEL = "Carl Admin";

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function pickActiveConversation(
  rows: AdminChatConversation[],
): AdminChatConversation | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const aAt = a.lastMessageAt ?? a.updatedAt ?? a.createdAt;
    const bAt = b.lastMessageAt ?? b.updatedAt ?? b.createdAt;
    return new Date(bAt).getTime() - new Date(aAt).getTime();
  });
  return sorted.find((row) => row.status === "OPEN") ?? sorted[0] ?? null;
}

function mergeMessages(
  existing: AdminChatMessage[],
  incoming: AdminChatMessage[],
): AdminChatMessage[] {
  const byId = new Map<string, AdminChatMessage>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="m2.5 8 11-5.5L9.5 8l4 5.5-11-5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminChatView({
  initialConversations,
}: {
  initialConversations: AdminChatConversation[];
}) {
  const { toast } = useToast();
  const [conversation, setConversation] = useState<AdminChatConversation | null>(
    () => pickActiveConversation(initialConversations),
  );
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [bootLoading, setBootLoading] = useState(
    () => initialConversations.length === 0,
  );
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchGen = useRef(0);
  const stickToBottom = useRef(true);
  const ensureInFlight = useRef(false);

  const conversationId = conversation?.id ?? null;

  const ensureConversation = useCallback(async (): Promise<AdminChatConversation | null> => {
    if (conversation?.status === "OPEN") return conversation;
    if (ensureInFlight.current) return conversation;
    ensureInFlight.current = true;
    try {
      const result = await openAdminChatAction({});
      if (!result.ok) {
        toast(result.message, "error");
        return null;
      }
      setConversation(result.data.conversation);
      if (result.data.message) {
        setMessages((prev) => mergeMessages(prev, [result.data.message!]));
      }
      return result.data.conversation;
    } finally {
      ensureInFlight.current = false;
    }
  }, [conversation, toast]);

  // First visit with no thread — open one quietly (like starting a DM).
  useEffect(() => {
    if (conversation) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setBootLoading(true);
      const result = await openAdminChatAction({});
      if (cancelled) return;
      setBootLoading(false);
      if (!result.ok) {
        setThreadError(result.message);
        return;
      }
      setConversation(result.data.conversation);
      if (result.data.message) {
        setMessages([result.data.message]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation]);

  const onSocketMessage = useCallback(
    (message: AdminChatMessage) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => mergeMessages(prev, [message]));
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessageAt: message.createdAt,
              updatedAt: message.createdAt,
              unreadCount: 0,
            }
          : prev,
      );
      if (message.sender === "ADMIN") {
        void markAdminChatReadAction(message.conversationId);
      }
    },
    [conversationId],
  );

  const onSocketConversation = useCallback(
    (row: AdminChatConversation) => {
      if (conversationId && row.id !== conversationId) return;
      setConversation(row);
    },
    [conversationId],
  );

  useAdminChatSocket({
    conversationId,
    onMessage: onSocketMessage,
    onConversationUpdated: onSocketConversation,
  });

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasOlder(false);
      return;
    }

    const gen = ++fetchGen.current;
    let cancelled = false;
    setThreadLoading(true);
    setThreadError(null);
    stickToBottom.current = true;

    void (async () => {
      const detail = await getAdminChatAction(conversationId);
      if (cancelled || gen !== fetchGen.current) return;

      if (!detail.ok) {
        setThreadLoading(false);
        setThreadError(detail.message);
        setMessages([]);
        return;
      }

      setConversation(detail.data.conversation);
      setMessages(detail.data.messages);
      setHasOlder(detail.data.messages.length >= PAGE_LIMIT);
      setThreadLoading(false);

      void markAdminChatReadAction(conversationId);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, threadLoading]);

  async function loadOlder() {
    if (!conversationId || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    const result = await listAdminChatMessagesAction(conversationId, {
      limit: PAGE_LIMIT,
      before: oldest.id,
    });
    setLoadingOlder(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    setHasOlder(result.data.length >= PAGE_LIMIT);
    setMessages((prev) => mergeMessages(result.data, prev));
  }

  async function handleSend() {
    if (sending) return;
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_CONTENT) {
      toast(`Message must be ${MAX_CONTENT} characters or fewer.`, "error");
      return;
    }

    setSending(true);
    stickToBottom.current = true;

    let active = conversation;
    if (!active || active.status === "CLOSED") {
      active = await ensureConversation();
      if (!active) {
        setSending(false);
        return;
      }
    }

    const result = await sendAdminChatMessageAction(active.id, content);
    setSending(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    setDraft("");
    setMessages((prev) => mergeMessages(prev, [result.data]));
    setConversation((prev) =>
      prev
        ? {
            ...prev,
            status: "OPEN",
            lastMessageAt: result.data.createdAt,
            updatedAt: result.data.createdAt,
          }
        : prev,
    );
  }

  const messageBlocks = useMemo(() => {
    const blocks: Array<
      | { type: "day"; key: string; label: string }
      | { type: "message"; key: string; message: AdminChatMessage }
    > = [];
    let lastDay = "";
    for (const message of messages) {
      const label = dayLabel(message.createdAt);
      if (label && label !== lastDay) {
        blocks.push({ type: "day", key: `day-${label}`, label });
        lastDay = label;
      }
      blocks.push({ type: "message", key: message.id, message });
    }
    return blocks;
  }, [messages]);

  if (bootLoading && !conversation) {
    return (
      <div className="flex min-h-112 items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface text-sm text-muted shadow-[var(--shadow-card)] lg:h-[calc(100dvh-11rem)]">
        Opening chat with Carl admin…
      </div>
    );
  }

  if (threadError && !conversation) {
    return (
      <EmptyState
        title="Can't open admin support"
        description={threadError}
        action={
          <Button
            type="button"
            onClick={() => {
              setThreadError(null);
              setBootLoading(true);
              void openAdminChatAction({}).then((result) => {
                setBootLoading(false);
                if (!result.ok) {
                  setThreadError(result.message);
                  return;
                }
                setConversation(result.data.conversation);
                if (result.data.message) {
                  setMessages([result.data.message]);
                }
              });
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex min-h-112 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)] lg:h-[calc(100dvh-11rem)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {ADMIN_LABEL}
          </p>
          <p className="truncate text-xs text-muted">
            Direct support · Message Carl ops anytime
          </p>
        </div>
        {conversation?.status === "OPEN" ? (
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success-foreground">
            Open
          </span>
        ) : conversation?.status === "CLOSED" ? (
          <span className="rounded-full bg-surface-hover px-2.5 py-1 text-[11px] font-semibold text-muted">
            Closed — send a message to continue
          </span>
        ) : null}
      </header>

      {threadLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Loading conversation…
        </div>
      ) : threadError ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            className="border-0 bg-transparent shadow-none"
            title="Can't load messages"
            description={threadError}
            action={
              <Button
                type="button"
                onClick={() => {
                  const id = conversationId;
                  setConversation(null);
                  requestAnimationFrame(() => {
                    if (id) {
                      setConversation({
                        id,
                        status: "OPEN",
                        createdAt: new Date().toISOString(),
                      });
                    }
                  });
                }}
              >
                Retry
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-muted/40 px-4 py-4"
            onScroll={(event) => {
              const el = event.currentTarget;
              stickToBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {hasOlder ? (
              <div className="flex justify-center pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 text-xs"
                  loading={loadingOlder}
                  onClick={() => void loadOlder()}
                >
                  Load earlier messages
                </Button>
              </div>
            ) : null}

            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">
                No messages yet. Ask Carl ops anything below.
              </p>
            ) : (
              messageBlocks.map((block) => {
                if (block.type === "day") {
                  return (
                    <div key={block.key} className="flex justify-center py-1">
                      <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-muted shadow-sm">
                        {block.label}
                      </span>
                    </div>
                  );
                }

                const message = block.message;
                const mine = message.sender === "AGENT";
                const system = message.sender === "SYSTEM";

                if (system) {
                  return (
                    <div key={block.key} className="flex justify-center">
                      <p className="max-w-md rounded-lg bg-surface px-3 py-1.5 text-center text-xs text-muted">
                        {message.content}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={block.key}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[min(85%,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm",
                        mine
                          ? "rounded-br-md bg-accent text-accent-foreground"
                          : "rounded-bl-md border border-border bg-surface text-foreground",
                      )}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-75">
                        {mine ? "You" : ADMIN_LABEL}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.content}
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-[10px] tabular-nums",
                          mine ? "text-accent-foreground/75" : "text-muted",
                        )}
                      >
                        {formatClock(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <footer className="shrink-0 border-t border-border bg-surface p-4">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
                className="min-h-11 max-h-32 flex-1 resize-none py-2.5"
                maxLength={MAX_CONTENT}
                disabled={sending}
                rows={1}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                type="submit"
                className="size-10 shrink-0 rounded-full p-0"
                loading={sending}
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <SendIcon />
              </Button>
            </form>
          </footer>
        </>
      )}
    </div>
  );
}
