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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type {
  AdminChatConversation,
  AdminChatMessage,
} from "@/types/admin-chat";

const MAX_CONTENT = 4000;
const PAGE_LIMIT = 50;

function formatRel(value: string | null | undefined): string {
  if (!value) return "";
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortConversations(
  rows: AdminChatConversation[],
): AdminChatConversation[] {
  return [...rows].sort((a, b) => {
    const aAt = a.lastMessageAt ?? a.updatedAt ?? a.createdAt;
    const bAt = b.lastMessageAt ?? b.updatedAt ?? b.createdAt;
    return new Date(bAt).getTime() - new Date(aAt).getTime();
  });
}

function upsertConversation(
  rows: AdminChatConversation[],
  next: AdminChatConversation,
): AdminChatConversation[] {
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

function senderLabel(sender: AdminChatMessage["sender"]): string {
  if (sender === "ADMIN") return "Admin";
  if (sender === "AGENT") return "You";
  return "System";
}

function threadTitle(row: AdminChatConversation): string {
  return row.subject?.trim() || "Admin chat";
}

export function AdminChatView({
  initialConversations,
}: {
  initialConversations: AdminChatConversation[];
}) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState(() =>
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
    setConversations(sortConversations(result.data));
  }, []);

  const onSocketMessage = useCallback((message: AdminChatMessage) => {
    const isOpenThread = message.conversationId === selectedId;

    setConversations((prev) => {
      const existing = prev.find((row) => row.id === message.conversationId);
      const next: AdminChatConversation = existing
        ? {
            ...existing,
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
  }, [selectedId]);

  const onSocketConversation = useCallback(
    (conversation: AdminChatConversation) => {
      setConversations((prev) => upsertConversation(prev, conversation));
    },
    [],
  );

  useAdminChatSocket({
    conversationId: selectedId,
    onMessage: onSocketMessage,
    onConversationUpdated: onSocketConversation,
  });

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadError(null);
      setHasOlder(false);
      return;
    }

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

      setConversations((prev) =>
        upsertConversation(prev, {
          ...detail.data.conversation,
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
    setConversations((prev) => upsertConversation(prev, conversation));
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

  return (
    <div className="grid min-h-128 gap-4 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.35fr)] lg:items-stretch">
      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Inbox</p>
            <p className="text-[11px] text-muted">
              {conversations.length} thread
              {conversations.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-8 px-2.5 text-xs"
            onClick={() => setComposerOpen((value) => !value)}
          >
            {composerOpen ? "Cancel" : "Message admin"}
          </Button>
        </div>

        {composerOpen ? (
          <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
            <input
              value={openSubject}
              onChange={(event) => setOpenSubject(event.target.value)}
              placeholder="Subject (optional)"
              className="h-9 w-full rounded-(--radius-md) border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
              maxLength={200}
            />
            <Textarea
              value={openMessage}
              onChange={(event) => setOpenMessage(event.target.value)}
              placeholder="First message (optional)"
              className="min-h-20"
              maxLength={MAX_CONTENT}
            />
            <Button
              type="button"
              fullWidth
              loading={opening}
              onClick={() => void handleOpenChat()}
            >
              Open chat
            </Button>
          </div>
        ) : null}

        {conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              title="No chats with admin yet"
              description="Start a thread when you need help from ops."
              action={
                <Button type="button" onClick={() => setComposerOpen(true)}>
                  Message admin
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((row) => {
              const active = row.id === selectedId;
              const unread = row.unreadCount ?? 0;
              return (
                <li key={row.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
                      active ? "bg-accent/5" : "hover:bg-accent/4",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        unread > 0 ? "bg-accent" : "bg-transparent",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {threadTitle(row)}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted">
                          {formatRel(row.lastMessageAt ?? row.updatedAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <Badge
                          variant={row.status === "OPEN" ? "success" : "muted"}
                          className="px-2 py-0.5 text-[10px] capitalize"
                        >
                          {row.status.toLowerCase()}
                        </Badge>
                        {unread > 0 ? (
                          <span className="text-[11px] font-semibold text-accent">
                            {unread} unread
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex min-h-112 flex-col gap-2 lg:min-h-0">
        {selected ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-border bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {threadTitle(selected)}
                </p>
                <p className="truncate text-[11px] text-muted">
                  Direct chat with Carl admin
                </p>
              </div>
              <Badge
                variant={selected.status === "OPEN" ? "success" : "muted"}
                className="capitalize"
              >
                {selected.status.toLowerCase()}
              </Badge>
            </div>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              {threadLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                  Loading conversation…
                </div>
              ) : threadError ? (
                <div className="flex flex-1 items-center justify-center p-4">
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
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
                    onScroll={(event) => {
                      const el = event.currentTarget;
                      stickToBottom.current =
                        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                    }}
                  >
                    {hasOlder ? (
                      <div className="flex justify-center">
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
                      <p className="py-8 text-center text-sm text-muted">
                        No messages yet. Say hello below.
                      </p>
                    ) : (
                      messages.map((message) => {
                        const mine = message.sender === "AGENT";
                        const system = message.sender === "SYSTEM";
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "flex",
                              system
                                ? "justify-center"
                                : mine
                                  ? "justify-end"
                                  : "justify-start",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                                system &&
                                  "rounded-lg bg-surface-hover px-3 py-1.5 text-center text-xs text-muted",
                                !system &&
                                  mine &&
                                  "bg-accent text-accent-foreground",
                                !system &&
                                  !mine &&
                                  "border border-border bg-surface text-foreground",
                              )}
                            >
                              {!system ? (
                                <p className="mb-0.5 text-[10px] font-semibold opacity-80">
                                  {senderLabel(message.sender)}
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              {!system ? (
                                <p
                                  className={cn(
                                    "mt-1 text-[10px] tabular-nums",
                                    mine ? "text-accent-foreground/80" : "text-muted",
                                  )}
                                >
                                  {formatClock(message.createdAt)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="shrink-0 border-t border-border p-3">
                    {selected.status === "CLOSED" ? (
                      <p className="text-center text-sm text-muted">
                        This chat is closed. Open a new one from the inbox.
                      </p>
                    ) : (
                      <form
                        className="flex flex-col gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSend();
                        }}
                      >
                        <Textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder="Write a message to admin…"
                          className="min-h-20"
                          maxLength={MAX_CONTENT}
                          disabled={sending}
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted">
                            Text only · Enter to send
                          </p>
                          <Button
                            type="submit"
                            loading={sending}
                            disabled={!draft.trim()}
                          >
                            Send
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title="Select a conversation"
            description="Pick a thread on the left, or message admin to start one."
            action={
              <Button type="button" onClick={() => setComposerOpen(true)}>
                Message admin
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
