"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import { CallButton } from "@/features/calls/components/call-button";
import { EmptyState } from "@/components/feedback/empty-state";
import { listTaskMessagesAction } from "@/features/tasks/actions/task-actions";
import {
  shouldHideRejectedOffer,
  useRejectedOfferTick,
} from "@/features/ops/rejected-offers";
import { useOps } from "@/features/ops/ops-provider";
import { useAgentMe } from "@/features/agents/hooks";
import {
  canMessageClient,
  isFailedOrCancelled,
  messageClientHint,
} from "@/features/tasks/lib/workflow";
import {
  lastChatActivityAt,
  lastChatPreview,
} from "@/features/messages/lib/preview";
import { previewForIncomingMessage } from "@/lib/realtime/parse-task-message";
import { dashboardExtrasApi } from "@/lib/api/dashboard-extras";
import { setViewingMessagesTaskId } from "@/lib/messages/viewing-chat";
import {
  callEndedMessageBody,
  isCallEndedMessageMetadata,
} from "@/types/call";
import { taskListSubtitle, taskPlaceLabel } from "@/lib/tasks/place-label";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { getAgentDisplayName } from "@/types/user";
import type { ConversationSummary } from "@/types/dashboard";
import type { TimelineEvent } from "@/types/message";
import type { Task } from "@/types/task";

type MessagesViewProps = {
  conversations: ConversationSummary[];
  tasks: Record<string, Task>;
};

type TimelineLoad =
  | { status: "loading" }
  | { status: "ready"; events: TimelineEvent[] }
  | { status: "error"; message: string };

const AVATAR_TONES = [
  "bg-[#dbeafe] text-[#1d4ed8]",
  "bg-[#fce7f3] text-[#be185d]",
  "bg-[#dcfce7] text-[#15803d]",
  "bg-[#ffedd5] text-[#c2410c]",
  "bg-[#ede9fe] text-[#6d28d9]",
] as const;

function formatRel(value: string): string {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m Ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h Ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1d Ago" : `${d}d Ago`;
}

function bookingRefFromTask(task: Task): string | null {
  const meta = task.metadata;
  if (!meta) return null;
  const candidates = [
    meta.bookingRef,
    meta.booking_ref,
    meta.reference,
    meta.confirmationCode,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Sidebar second line: place/venue so duplicate client names stay distinct. */
function sidebarSubtitle(
  conversation: ConversationSummary,
  task?: Task,
): string {
  if (task) return taskListSubtitle(task, conversation.taskTitle);
  if (
    conversation.lastMessage &&
    conversation.lastMessage !== "No messages yet"
  ) {
    return conversation.lastMessage;
  }
  return conversation.taskTitle;
}

function threadSignature(thread: TimelineEvent[]): string {
  return thread.map((event) => event.id).join("\u0001");
}

function unseenLabel(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "1 msg unseen";
  return `${count} msgs unseen`;
}

function formatBookingRef(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash] ?? AVATAR_TONES[0]!;
}

function ConversationAvatar({
  name,
  size = 42,
  showOnline = false,
}: {
  name: string;
  size?: number;
  showOnline?: boolean;
}) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn(
          "flex size-full items-center justify-center rounded-full text-[12px] font-semibold tracking-[-0.02em]",
          avatarTone(name),
        )}
        aria-hidden
      >
        {initialsFromName(name)}
      </span>
      {showOnline ? (
        <span
          className="absolute bottom-0 right-0 size-[7px] rounded-full border border-white bg-[#27ca40]"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export function MessagesView({ conversations, tasks }: MessagesViewProps) {
  const ops = useOps();
  const { data: agent } = useAgentMe();
  const agentLabel = agent ? getAgentDisplayName(agent) : "You";
  const rejectedTick = useRejectedOfferTick();
  const visibleConversations = useMemo(
    () =>
      conversations.filter((c) => {
        const row = tasks[c.taskId];
        return !row || !shouldHideRejectedOffer(row);
      }),
    [conversations, rejectedTick, tasks],
  );

  const [selectedId, setSelectedId] = useState(
    visibleConversations[0]?.taskId ?? null,
  );
  const [timelines, setTimelines] = useState<Record<string, TimelineLoad>>(
    {},
  );
  const [unreadByTaskId, setUnreadByTaskId] = useState<Record<string, number>>(
    {},
  );
  const [filter, setFilter] = useState("");
  const [bookingRefs, setBookingRefs] = useState<Record<string, string | null>>(
    {},
  );
  const inflightRef = useRef(new Set<string>());
  const timelinesRef = useRef(timelines);
  timelinesRef.current = timelines;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const liveChatAt = ops?.liveChat?.at ?? 0;

  useEffect(() => {
    setViewingMessagesTaskId(selectedId);
    return () => setViewingMessagesTaskId(null);
  }, [selectedId]);

  const clearUnread = useCallback((taskId: string) => {
    setUnreadByTaskId((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  const bumpUnread = useCallback((taskId: string) => {
    if (selectedIdRef.current === taskId) return;
    setUnreadByTaskId((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? 0) + 1,
    }));
  }, []);

  const loadTimeline = useCallback((taskId: string, force = false) => {
    if (!force && inflightRef.current.has(taskId)) return;
    const existing = timelinesRef.current[taskId];
    if (!force && existing?.status === "ready") return;
    if (!force && existing?.status === "loading") return;
    inflightRef.current.add(taskId);
    setTimelines((prev) => ({
      ...prev,
      [taskId]: { status: "loading" },
    }));
    void listTaskMessagesAction(taskId)
      .then((result) => {
        if (!result.ok) {
          setTimelines((prev) => ({
            ...prev,
            [taskId]: { status: "error", message: result.message },
          }));
          return;
        }
        setTimelines((prev) => ({
          ...prev,
          [taskId]: { status: "ready", events: result.events },
        }));
      })
      .finally(() => {
        inflightRef.current.delete(taskId);
      });
  }, []);

  const displayConversations = useMemo(() => {
    const rows = visibleConversations.map((c) => {
      const load = timelines[c.taskId];
      const events = load?.status === "ready" ? load.events : undefined;
      const place = sidebarSubtitle(c, tasks[c.taskId]);
      const chatPreview = events ? lastChatPreview(events) : null;
      const activityAt =
        (events ? lastChatActivityAt(events) : null) ?? c.lastActivityAt;
      const unread = unreadByTaskId[c.taskId] ?? c.unreadCount ?? 0;
      return {
        ...c,
        lastMessage: chatPreview ?? place,
        lastActivityAt: activityAt,
        unreadCount: unread,
      };
    });
    return rows.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
  }, [tasks, timelines, unreadByTaskId, visibleConversations]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return displayConversations.filter((c) => {
      if (!q) return true;
      const row = tasks[c.taskId];
      return (
        c.taskTitle.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        (row?.customerName.toLowerCase().includes(q) ?? false) ||
        String(c.taskNumber).includes(q)
      );
    });
  }, [displayConversations, filter, tasks]);

  const selected = useMemo(
    () => filtered.find((c) => c.taskId === selectedId) ?? null,
    [filtered, selectedId],
  );
  const task = selectedId ? tasks[selectedId] : null;
  const timelineLoad = selectedId ? timelines[selectedId] : undefined;
  const timeline =
    timelineLoad?.status === "ready" ? timelineLoad.events : [];
  const chatReady = timelineLoad?.status === "ready";
  const chatError =
    timelineLoad?.status === "error" ? timelineLoad.message : null;
  const chatLoading =
    selectedId != null &&
    (timelineLoad == null || timelineLoad.status === "loading");
  const taskPlace = task ? taskPlaceLabel(task) : "—";
  const taskContext =
    task && taskPlace !== "—"
      ? taskPlace
      : task?.title?.trim() || selected?.taskTitle || "";

  useEffect(() => {
    if (!selectedId) return;
    if (filtered.some((c) => c.taskId === selectedId)) return;
    setSelectedId(filtered[0]?.taskId ?? null);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    loadTimeline(selectedId);
    clearUnread(selectedId);
  }, [clearUnread, loadTimeline, selectedId]);

  // Intentionally no bulk prefetch of every conversation — each listTaskMessagesAction
  // is a ~2s server POST. Sidebar uses conversation.lastMessage until a chat is opened.

  useEffect(() => {
    const live = ops?.liveChat;
    if (!live?.taskId) return;
    // Own agent sends already land via TaskChatThread optimistic/upload.
    // Echoing them here duplicates the bubble with a second id.
    const isUser = live.sender === "USER";
    const isCallEnded =
      live.sender === "SYSTEM" && isCallEndedMessageMetadata(live.metadata);
    if (!isUser && !isCallEnded) return;

    const existingLoad = timelinesRef.current[live.taskId];
    // If we never loaded this thread (or last load failed), fetch history
    // instead of showing only the live ping.
    if (existingLoad?.status !== "ready") {
      if (isUser) bumpUnread(live.taskId);
      loadTimeline(live.taskId, true);
      return;
    }

    const existing = existingLoad.events;
    if (live.messageId && existing.some((row) => row.id === live.messageId)) {
      return;
    }

    const body = isCallEnded
      ? callEndedMessageBody(live.content, live.metadata)
      : previewForIncomingMessage({
          taskId: live.taskId,
          sender: live.sender,
          content: live.content,
          clientLabel: "",
          messageId: live.messageId,
          mediaKind: live.mediaKind ?? "text",
          durationMs: live.durationMs,
          metadata: live.metadata,
        });

    const nextEvent: TimelineEvent = {
      id: live.messageId ?? `live-${live.at}`,
      taskId: live.taskId,
      kind: isCallEnded ? "system" : "customer_message",
      body,
      createdAt: new Date(live.at).toISOString(),
      visibleToCustomer: !isCallEnded,
      mediaKind: live.mediaKind ?? "text",
      durationMs: live.durationMs,
      metadata: live.metadata ?? null,
    };

    setTimelines((prev) => {
      const ready = prev[live.taskId];
      const rows = ready?.status === "ready" ? ready.events : [];
      if (live.messageId && rows.some((row) => row.id === live.messageId)) {
        return prev;
      }
      return {
        ...prev,
        [live.taskId]: { status: "ready", events: [...rows, nextEvent] },
      };
    });
    if (isUser) bumpUnread(live.taskId);
  }, [bumpUnread, liveChatAt, loadTimeline, ops?.liveChat]);

  const handleThreadUpdate = useCallback(
    (taskId: string, thread: TimelineEvent[]) => {
      // Parent timeline is durable only — never keep optimistic upload rows.
      const durable = thread.filter(
        (event) =>
          !event.id.startsWith("opt-") && !event.id.startsWith("local-"),
      );
      const sig = threadSignature(durable);
      setTimelines((prev) => {
        const current = prev[taskId];
        if (
          current?.status === "ready" &&
          threadSignature(current.events) === sig
        ) {
          return prev;
        }
        return { ...prev, [taskId]: { status: "ready", events: durable } };
      });
    },
    [],
  );

  const handleSelectedThreadUpdate = useCallback(
    (thread: TimelineEvent[]) => {
      if (!selectedId) return;
      handleThreadUpdate(selectedId, thread);
    },
    [handleThreadUpdate, selectedId],
  );

  useEffect(() => {
    if (!task) return;
    const taskId = task.id;
    const fromMeta = bookingRefFromTask(task);
    if (fromMeta) {
      setBookingRefs((prev) =>
        prev[taskId] === fromMeta ? prev : { ...prev, [taskId]: fromMeta },
      );
      return;
    }
    let cancelled = false;
    void dashboardExtrasApi.getTaskChatMeta(taskId).then((row) => {
      if (cancelled) return;
      setBookingRefs((prev) =>
        Object.hasOwn(prev, taskId)
          ? prev
          : { ...prev, [taskId]: row.bookingRef },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [task]);

  if (visibleConversations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-foreground">
              Chat Box
            </h2>
            <p className="mt-3 text-[14px] tracking-[-0.02em] text-muted">
              Message clients on your open tasks
            </p>
          </div>
          <AvailabilityToggle />
        </div>
        <EmptyState
          title="No conversations yet"
          description="When clients message on your tasks, threads show up here."
        />
      </div>
    );
  }

  const bookingRef = task ? bookingRefs[task.id] : null;

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] flex-col gap-5 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-foreground">
            Chat Box
          </h2>
          <p className="mt-3 text-[14px] tracking-[-0.02em] text-muted">
            Message clients on your open tasks
          </p>
        </div>
        <AvailabilityToggle />
      </div>

      {/* Figma: list 292px + gap ~25px + chat; panels end with a small bottom gap */}
      <div className="grid min-h-0 flex-1 gap-[25px] overflow-hidden lg:grid-cols-[minmax(292px,320px)_minmax(0,1fr)] lg:items-stretch">
        <aside className="dash-card-shimmer flex h-full min-h-0 flex-col overflow-hidden rounded-[15px] border border-border bg-surface">
          <div className="shrink-0 px-5 pt-5">
            <div className="flex h-10 items-center gap-2 rounded-[8px] border border-border bg-surface px-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
                className="size-5 shrink-0 text-foreground"
              >
                <path
                  d="M8.47 3.33a6.74 6.74 0 0 1 6.81 6.74c0 .77-.13 1.5-.38 2.2a6.6 6.6 0 0 1-1.02 1.88l4.17 4.16a.96.96 0 0 1-.7 1.69c-.14 0-.27-.03-.4-.08a.96.96 0 0 1-.33-.21l-4.2-4.17a6.7 6.7 0 0 1-3.95 1.27 6.74 6.74 0 1 1 0-13.48Zm0 1.45a5.29 5.29 0 1 0 0 10.59 5.29 5.29 0 0 0 0-10.59Z"
                  fill="currentColor"
                  fillOpacity="0.7"
                />
              </svg>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search"
                aria-label="Search chats"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-6 text-foreground outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-0 pb-3 pt-2">
            {filtered.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted">
                {filter.trim() ? "No chats match this search." : "No chats yet."}
              </li>
            ) : (
              filtered.map((c, index) => {
                const active = c.taskId === selectedId;
                const rowTask = tasks[c.taskId];
                const customerName =
                  rowTask?.customerName ?? `Task #${c.taskNumber}`;
                return (
                  <li key={c.taskId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.taskId)}
                      className={cn(
                        "task-row-in task-row-shimmer flex w-full items-start gap-2.5 px-5 py-[10px] text-left transition-colors",
                        active ? "bg-surface-muted" : "hover:bg-surface-muted/70",
                      )}
                      style={{ "--row-i": index } as CSSProperties}
                    >
                      <ConversationAvatar
                        name={customerName}
                        showOnline={c.unreadCount === 0}
                      />
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[14px] leading-[14px] tracking-[-0.02em] text-foreground",
                              c.unreadCount > 0
                                ? "font-bold"
                                : "font-semibold",
                            )}
                          >
                            {customerName}
                          </span>
                          <span className="inline-flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[10px] leading-[10px] tracking-[-0.02em] text-muted-dim">
                              {formatRel(c.lastActivityAt)}
                            </span>
                            {c.unreadCount > 0 ? (
                              <span
                                className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground"
                                title={unseenLabel(c.unreadCount)}
                                aria-label={unseenLabel(c.unreadCount)}
                              >
                                {c.unreadCount > 99 ? "99+" : c.unreadCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-1 block truncate text-[14px] leading-[14px] tracking-[-0.02em]",
                            c.unreadCount > 0
                              ? "font-semibold text-foreground"
                              : "text-muted",
                          )}
                        >
                          {c.unreadCount > 0
                            ? unseenLabel(c.unreadCount)
                            : c.lastMessage}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {selected && task ? (
            <div
              className="dash-card-shimmer flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[15px] border border-border bg-surface"
              style={{ "--row-i": 1 } as CSSProperties}
            >
              <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ConversationAvatar name={task.customerName} size={34} />
                  <div className="min-w-0 leading-[14px]">
                    <h3 className="truncate text-[12px] font-semibold text-foreground">
                      {task.customerName}
                    </h3>
                    <p className="truncate text-[12px] font-medium text-muted">
                      {taskContext ? `${taskContext} · Online` : "Online"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {bookingRef ? (
                    <p className="text-[11px] text-muted-dim">
                      {formatBookingRef(bookingRef)} · #{task.number}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-dim">
                      Ticket #T-{task.number}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <CallButton
                      taskId={task.id}
                      customerName={task.customerName}
                      taskTitle={task.title}
                      taskNumber={task.number}
                      disabled={!canMessageClient(task)}
                    />
                    <Link
                      href={ROUTES.taskPanel(task.id, "chat")}
                      className="text-[12px] font-semibold text-accent hover:text-accent-hover"
                    >
                      Open workspace
                    </Link>
                  </div>
                </div>
              </header>
              <div className="h-px w-full shrink-0 bg-border" />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {chatLoading ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="size-8 animate-pulse rounded-full bg-accent-soft" />
                    <p className="text-sm text-foreground">
                      Loading conversation…
                    </p>
                  </div>
                ) : chatError ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-sm text-foreground">
                      Couldn’t load messages
                    </p>
                    <p className="max-w-sm text-xs text-muted">{chatError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        selectedId && loadTimeline(selectedId, true)
                      }
                      className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
                    >
                      Try again
                    </button>
                  </div>
                ) : chatReady ? (
                  <TaskChatThread
                    taskId={selected.taskId}
                    timeline={timeline}
                    quickActions={task.aiBrief?.missingInfo ?? []}
                    title=""
                    subtitle=""
                    clientLabel={task.customerName}
                    agentLabel={agentLabel}
                    appearance="inbox"
                    fillHeight
                    className="min-h-0 flex-1 rounded-none border-0 shadow-none"
                    showTemplates={
                      canMessageClient(task) && !isFailedOrCancelled(task)
                    }
                    disabled={!canMessageClient(task)}
                    disabledHint={messageClientHint(task)}
                    onThreadUpdate={handleSelectedThreadUpdate}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-[15px] border border-border bg-surface">
              <EmptyState
                title="Select a conversation"
                description="Pick a thread on the left to reply."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
