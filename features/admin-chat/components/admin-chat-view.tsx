"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminChatAction,
  listAdminChatMessagesAction,
  listAdminChatsAction,
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

type ConversationRow = AdminChatConversation & {
  preview?: string;
};

function formatRel(value: string | null | undefined): string {
  if (!value) return "";
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

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

function sortConversations(rows: ConversationRow[]): ConversationRow[] {
  return [...rows].sort((a, b) => {
    const aAt = a.lastMessageAt ?? a.updatedAt ?? a.createdAt;
    const bAt = b.lastMessageAt ?? b.updatedAt ?? b.createdAt;
    return new Date(bAt).getTime() - new Date(aAt).getTime();
  });
}

function upsertConversation(
  rows: ConversationRow[],
  next: ConversationRow,
): ConversationRow[] {
  const without = rows.filter((row) => row.id !== next.id);
  return sortConversations([next, ...without]);
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

function threadTitle(row: ConversationRow): string {
  return row.subject?.trim() || ADMIN_LABEL;
}

function previewFromMessage(message: AdminChatMessage): string {
  const text = message.content.trim();
  return text || "Message";
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22" className="stroke-accent/25" strokeWidth="2" />
      <path
        d="M24 28v-2m0-10a2.5 2.5 0 0 0-2.5 2.5V22c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V18.5A2.5 2.5 0 0 0 24 16Z"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 24a10 10 0 0 0 20 0"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 24v3a2 2 0 0 0 2 2h2m16-5v3a2 2 0 0 1-2 2h-2"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
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
  const [conversations, setConversations] = useState<ConversationRow[]>(() =>
    sortConversations(initialConversations),
  );
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [openSubject, setOpenSubject] = useState("");
  const [openMessage, setOpenMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchGen = useRef(0);
  const stickToBottom = useRef(true);
  const prefetchedPreviews = useRef(new Set<string>());

  const selected = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const result = await listAdminChatsAction();
    setListLoading(false);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setConversations((prev) => {
      const previews = new Map(prev.map((row) => [row.id, row.preview]));
      return sortConversations(
        result.data.map((row) => ({
          ...row,
          preview: previews.get(row.id),
        })),
      );
    });
  }, []);

  const onSocketMessage = useCallback(
    (message: AdminChatMessage) => {
      const isOpenThread = message.conversationId === selectedId;
      const preview = previewFromMessage(message);

      setConversations((prev) => {
        const existing = prev.find((row) => row.id === message.conversationId);
        const next: ConversationRow = existing
          ? {
              ...existing,
              preview,
              lastMessageAt: message.createdAt,
              updatedAt: message.createdAt,
              unreadCount:
                message.sender === "ADMIN" && !isOpenThread
                  ? (existing.unreadCount ?? 0) + 1
                  : isOpenThread
                    ? 0
                    : existing.unreadCount,
            }
          : {
              id: message.conversationId,
              status: "OPEN",
              subject: null,
              preview,
              lastMessageAt: message.createdAt,
              createdAt: message.createdAt,
              updatedAt: message.createdAt,
              closedAt: null,
              unreadCount: message.sender === "ADMIN" && !isOpenThread ? 1 : 0,
            };
        return upsertConversation(prev, next);
      });

      if (!isOpenThread) return;
      setMessages((prev) => mergeMessages(prev, [message]));
      if (message.sender === "ADMIN") {
        void markAdminChatReadAction(message.conversationId);
      }
    },
    [selectedId],
  );

  const onSocketConversation = useCallback(
    (conversation: AdminChatConversation) => {
      setConversations((prev) => {
        const existing = prev.find((row) => row.id === conversation.id);
        return upsertConversation(prev, {
          ...conversation,
          preview: existing?.preview,
        });
      });
    },
    [],
  );

  useAdminChatSocket({
    conversationId: selectedId,
    onMessage: onSocketMessage,
    onConversationUpdated: onSocketConversation,
  });

  useEffect(() => {
    const missing = conversations.filter(
      (row) => !row.preview && !prefetchedPreviews.current.has(row.id),
    );
    if (missing.length === 0) return;
    let cancelled = false;

    void Promise.all(
      missing.map(async (row) => {
        prefetchedPreviews.current.add(row.id);
        const result = await listAdminChatMessagesAction(row.id, {
          limit: PAGE_LIMIT,
        });
        if (!result.ok || result.data.length === 0) return null;
        const last = result.data[result.data.length - 1];
        return [row.id, previewFromMessage(last)] as const;
      }),
    ).then((rows) => {
      if (cancelled) return;
      setConversations((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          const hit = rows.find((entry) => entry?.[0] === row.id);
          if (!hit || row.preview) return row;
          changed = true;
          return { ...row, preview: hit[1] };
        });
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [conversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadError(null);
      setHasOlder(false);
      return;
    }

    setComposerOpen(false);
    const conversationId = selectedId;
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

      const last = detail.data.messages.at(-1);
      setConversations((prev) =>
        upsertConversation(prev, {
          ...detail.data.conversation,
          preview: last ? previewFromMessage(last) : undefined,
          unreadCount: 0,
        }),
      );
      setMessages(detail.data.messages);
      setHasOlder(detail.data.messages.length >= PAGE_LIMIT);
      setThreadLoading(false);

      void markAdminChatReadAction(conversationId).then((readResult) => {
        if (!readResult.ok) return;
        setConversations((prev) =>
          prev.map((row) =>
            row.id === conversationId ? { ...row, unreadCount: 0 } : row,
          ),
        );
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, threadLoading]);

  async function loadOlder() {
    if (!selectedId || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    const result = await listAdminChatMessagesAction(selectedId, {
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
    if (!selectedId || sending) return;
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_CONTENT) {
      toast(`Message must be ${MAX_CONTENT} characters or fewer.`, "error");
      return;
    }
    if (selected?.status === "CLOSED") {
      toast("This chat is closed.", "error");
      return;
    }

    setSending(true);
    stickToBottom.current = true;
    const result = await sendAdminChatMessageAction(selectedId, content);
    setSending(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    setDraft("");
    setMessages((prev) => mergeMessages(prev, [result.data]));
    setConversations((prev) =>
      upsertConversation(prev, {
        ...(selected ?? {
          id: selectedId,
          status: "OPEN",
          subject: null,
          createdAt: result.data.createdAt,
          closedAt: null,
        }),
        preview: previewFromMessage(result.data),
        lastMessageAt: result.data.createdAt,
        updatedAt: result.data.createdAt,
      }),
    );
  }

  async function handleOpenChat() {
    if (opening) return;
    setOpening(true);
    const result = await openAdminChatAction({
      subject: openSubject.trim() || undefined,
      message: openMessage.trim() || undefined,
    });
    setOpening(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }

    const { conversation, message } = result.data;
    setConversations((prev) =>
      upsertConversation(prev, {
        ...conversation,
        preview: message ? previewFromMessage(message) : undefined,
      }),
    );
    setSelectedId(conversation.id);
    setComposerOpen(false);
    setOpenSubject("");
    setOpenMessage("");
    if (message) {
      setMessages((prev) => mergeMessages(prev, [message]));
    }
    toast(
      result.data.created ? "Chat opened with admin." : "Opened existing chat.",
      "success",
    );
  }

  function startNewChat() {
    setSelectedId(null);
    setComposerOpen(true);
    setOpenSubject("");
    setOpenMessage("");
  }

  if (listError && conversations.length === 0) {
    return (
      <EmptyState
        title="Can't load admin chats"
        description={listError}
        action={
          <Button type="button" onClick={() => void refreshList()} loading={listLoading}>
            Try again
          </Button>
        }
      />
    );
  }

  const hasConversations = conversations.length > 0;
  const showNewChatComposer = composerOpen && !selectedId;

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

  return (
    <div className="grid min-h-128 gap-4 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.4fr)] lg:items-stretch">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Inbox</p>
            <p className="text-xs text-muted">
              {conversations.length} thread
              {conversations.length === 1 ? "" : "s"}
            </p>
          </div>
          {hasConversations ? (
            <Button
              type="button"
              variant="secondary"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={startNewChat}
            >
              <PlusIcon />
              New chat
            </Button>
          ) : null}
        </div>

        {hasConversations ? (
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.map((row) => {
              const active = row.id === selectedId;
              const unread = row.unreadCount ?? 0;
              return (
                <li key={row.id} className="mb-1 last:mb-0">
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setSelectedId(row.id);
                    }}
                    className={cn(
                      "relative flex w-full items-start gap-2 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-accent/40 bg-accent-soft"
                        : "border-transparent hover:border-border hover:bg-surface-hover",
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {ADMIN_LABEL}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted">
                            {threadTitle(row)}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] tabular-nums text-muted">
                            {formatRel(row.lastMessageAt ?? row.updatedAt)}
                          </span>
                          {unread > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                              {unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-1 text-xs text-muted">
                        {row.preview ?? "No messages yet"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
            <p className="text-sm text-muted">No conversations yet</p>
          </div>
        )}
      </aside>

      <section className="flex min-h-112 min-w-0 flex-col lg:min-h-0">
        {showNewChatComposer ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                New message to admin
              </h2>
              <p className="mt-1 text-sm text-muted">
                Reach Carl ops for help with tasks, payments, or account issues.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Subject
                </span>
                <input
                  value={openSubject}
                  onChange={(event) => setOpenSubject(event.target.value)}
                  placeholder="What do you need help with? (optional)"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                  maxLength={200}
                />
              </label>
              <label className="flex min-h-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Message
                </span>
                <Textarea
                  value={openMessage}
                  onChange={(event) => setOpenMessage(event.target.value)}
                  placeholder="Describe your question or issue…"
                  className="min-h-40 flex-1"
                  maxLength={MAX_CONTENT}
                />
              </label>
              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setComposerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={opening}
                  onClick={() => void handleOpenChat()}
                >
                  Send message
                </Button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {ADMIN_LABEL}
                </p>
                <p className="truncate text-xs text-muted">
                  {threadTitle(selected)}
                  {selected.status === "CLOSED" ? " · Closed" : " · Direct support"}
                </p>
              </div>
              {selected.status === "OPEN" ? (
                <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success-foreground">
                  Open
                </span>
              ) : (
                <span className="rounded-full bg-surface-hover px-2.5 py-1 text-[11px] font-semibold text-muted">
                  Closed
                </span>
              )}
            </header>

            {threadLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                Loading conversation…
              </div>
            ) : threadError ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  className="border-0 bg-transparent shadow-none"
                  title="Can't open this chat"
                  description={threadError}
                  action={
                    <Button
                      type="button"
                      onClick={() => {
                        const id = selectedId;
                        setSelectedId(null);
                        requestAnimationFrame(() => setSelectedId(id));
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
                      No messages yet. Send the first message below.
                    </p>
                  ) : (
                    messageBlocks.map((block) => {
                      if (block.type === "day") {
                        return (
                          <div
                            key={block.key}
                            className="flex justify-center py-1"
                          >
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
                  {selected.status === "CLOSED" ? (
                    <div className="rounded-[var(--radius-md)] bg-surface-muted px-4 py-3 text-center text-sm text-muted">
                      This chat is closed. Start a new conversation using{" "}
                      <button
                        type="button"
                        className="font-semibold text-accent hover:text-accent-hover"
                        onClick={startNewChat}
                      >
                        New chat
                      </button>
                      .
                    </div>
                  ) : (
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
                  )}
                </footer>
              </>
            )}
          </div>
        ) : hasConversations ? (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              title="Select a conversation"
              description="Choose a thread from the inbox to continue chatting with admin."
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
            <EmptyState
              className="max-w-md border-0 bg-transparent shadow-none"
              icon={<SupportIcon className="size-16" />}
              title="Message Carl admin"
              description="Get help from ops with tasks, payments, or anything blocking your work."
              action={
                <Button type="button" onClick={startNewChat}>
                  Start a conversation
                </Button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
