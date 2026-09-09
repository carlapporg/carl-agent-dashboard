"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
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

type ListTab = "all" | "unread";

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

function sidebarPreview(
  conversation: ConversationSummary,
  events: TimelineEvent[] | undefined,
): string {
  const fromThread = events ? lastChatPreview(events) : null;
  if (fromThread) return fromThread;
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
  const [timelines, setTimelines] = useState<Record<string, TimelineEvent[]>>(
    {},
  );
  const [filter, setFilter] = useState("");
  const [listTab, setListTab] = useState<ListTab>("all");
  const [bookingRefs, setBookingRefs] = useState<Record<string, string | null>>(
    {},
  );
  const inflightRef = useRef(new Set<string>());
  const liveChatAt = ops?.liveChat?.at ?? 0;

  const loadTimeline = useCallback((taskId: string) => {
    if (inflightRef.current.has(taskId)) return;
    inflightRef.current.add(taskId);
    void listTaskMessagesAction(taskId)
      .then((events) => {
        setTimelines((prev) => ({ ...prev, [taskId]: events }));
      })
      .finally(() => {
        inflightRef.current.delete(taskId);
      });
  }, []);

  const displayConversations = useMemo(() => {
    const rows = visibleConversations.map((c) => {
      const events = timelines[c.taskId];
      const preview = sidebarPreview(c, events);
      const activityAt =
        (events ? lastChatActivityAt(events) : null) ?? c.lastActivityAt;
      return { ...c, lastMessage: preview, lastActivityAt: activityAt };
    });
    return rows.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
  }, [timelines, visibleConversations]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return displayConversations.filter((c) => {
      if (listTab === "unread" && c.unreadCount <= 0) return false;
      if (!q) return true;
      const row = tasks[c.taskId];
      return (
        c.taskTitle.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        (row?.customerName.toLowerCase().includes(q) ?? false) ||
        String(c.taskNumber).includes(q)
      );
    });
  }, [displayConversations, filter, listTab, tasks]);

  const selected = useMemo(
    () => filtered.find((c) => c.taskId === selectedId) ?? null,
    [filtered, selectedId],
  );
  const task = selectedId ? tasks[selectedId] : null;
  const timeline = selectedId ? (timelines[selectedId] ?? []) : [];
  const chatReady = selectedId != null && Object.hasOwn(timelines, selectedId);

  useEffect(() => {
    if (!selectedId) return;
    if (filtered.some((c) => c.taskId === selectedId)) return;
    setSelectedId(filtered[0]?.taskId ?? null);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    loadTimeline(selectedId);
  }, [loadTimeline, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const others = visibleConversations
      .map((c) => c.taskId)
      .filter((id) => id !== selectedId);

    void (async () => {
      for (const taskId of others) {
        if (cancelled) return;
        if (inflightRef.current.has(taskId)) continue;
        inflightRef.current.add(taskId);
        try {
          const events = await listTaskMessagesAction(taskId);
          if (cancelled) return;
          setTimelines((prev) =>
            Object.hasOwn(prev, taskId) ? prev : { ...prev, [taskId]: events },
          );
        } finally {
          inflightRef.current.delete(taskId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, visibleConversations]);

  useEffect(() => {
    const live = ops?.liveChat;
    if (!live?.taskId) return;
    // Own agent sends already land via TaskChatThread optimistic/upload.
    // Echoing them here duplicates the bubble with a second id.
    if (live.sender !== "USER") return;

    setTimelines((prev) => {
      const existing = prev[live.taskId] ?? [];
      if (live.messageId && existing.some((row) => row.id === live.messageId)) {
        return prev;
      }

      const preview = previewForIncomingMessage({
        taskId: live.taskId,
        sender: live.sender,
        content: live.content,
        clientLabel: "",
        messageId: live.messageId,
        mediaKind: live.mediaKind ?? "text",
        durationMs: live.durationMs,
      });

      const nextEvent: TimelineEvent = {
        id: live.messageId ?? `live-${live.at}`,
        taskId: live.taskId,
        kind: "customer_message",
        body: preview,
        createdAt: new Date(live.at).toISOString(),
        visibleToCustomer: true,
        mediaKind: live.mediaKind ?? "text",
        durationMs: live.durationMs,
      };

      return { ...prev, [live.taskId]: [...existing, nextEvent] };
    });
  }, [liveChatAt, ops?.liveChat]);

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
        if (current && threadSignature(current) === sig) return prev;
        return { ...prev, [taskId]: durable };
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
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-[#1f1f21]">
              Chat Box
            </h2>
            <p className="mt-3 text-[14px] tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              Your current sales summary and activity
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
    <div className="flex h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] flex-col gap-5 overflow-hidden pb-2">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-[#1f1f21]">
            Chat Box
          </h2>
          <p className="mt-3 text-[14px] tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
            Your current sales summary and activity
          </p>
        </div>
        <AvailabilityToggle />
      </div>

      {/* Figma: list 292px + gap ~25px + chat; panels end with a small bottom gap */}
      <div className="grid min-h-0 flex-1 gap-[25px] overflow-hidden lg:grid-cols-[minmax(292px,320px)_minmax(0,1fr)] lg:items-stretch">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-[#fdfdfd]">
          <div className="shrink-0 px-5 pt-5">
            <div className="flex h-10 items-center gap-2 rounded-[8px] border border-[#e7e7e7] bg-white px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/figma/messages/icon-search.svg"
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0"
              />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search"
                aria-label="Search chats"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-6 text-[#1f1f21] outline-none placeholder:text-[rgba(31,31,33,0.56)]"
              />
            </div>

            {/* All / Unread stay above the list — Figma tabs + 8px gap under indicator */}
            <div className="mt-4 flex items-end gap-6 border-b border-[#e7e7e7] pb-0">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "unread", label: "Unread" },
                ] as const
              ).map((tab) => {
                const active = listTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setListTab(tab.value)}
                    className={cn(
                      "relative pb-2 text-[14px] font-semibold tracking-[-0.02em]",
                      active ? "text-[#377dff]" : "text-[rgba(0,0,0,0.45)] font-medium",
                    )}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 w-5 rounded-[1px] bg-[#377dff]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-0 pb-3 pt-2">
            {filtered.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-[rgba(0,0,0,0.45)]">
                No chats match this filter.
              </li>
            ) : (
              filtered.map((c) => {
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
                        "flex w-full items-start gap-2.5 px-5 py-[10px] text-left transition-colors",
                        active ? "bg-[#f6f6f6]" : "hover:bg-[#f6f6f6]/70",
                      )}
                    >
                      <ConversationAvatar
                        name={customerName}
                        showOnline={c.unreadCount === 0}
                      />
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-[14px] font-semibold leading-[14px] tracking-[-0.02em] text-black">
                            {customerName}
                          </span>
                          <span className="shrink-0 text-[10px] leading-[10px] tracking-[-0.02em] text-[rgba(0,0,0,0.4)]">
                            {formatRel(c.lastActivityAt)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-[14px] leading-[14px] tracking-[-0.02em] text-[rgba(0,0,0,0.45)]">
                          {c.lastMessage}
                        </span>
                      </span>
                      {c.unreadCount > 0 ? (
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-[#377dff]"
                          aria-label="Unread"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden">
          {selected && task ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-white">
              <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ConversationAvatar name={task.customerName} size={34} />
                  <div className="min-w-0 leading-[14px]">
                    <h3 className="truncate text-[12px] font-semibold text-black">
                      {task.customerName}
                    </h3>
                    <p className="truncate text-[12px] font-medium text-[#777583]">
                      Online
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {bookingRef ? (
                    <p className="text-[11px] text-[rgba(0,0,0,0.4)]">
                      {formatBookingRef(bookingRef)} · #{task.number}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[rgba(0,0,0,0.4)]">
                      Ticket #T-{task.number}
                    </p>
                  )}
                  <Link
                    href={ROUTES.taskPanel(task.id, "chat")}
                    className="text-[12px] font-semibold text-[#377dff] hover:text-[#2f6ae6]"
                  >
                    Open workspace
                  </Link>
                </div>
              </header>
              <div className="h-px w-full bg-[#eef0f2]" />

              <div className="min-h-0 flex-1 overflow-hidden">
                {!chatReady ? (
                  <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="size-8 animate-pulse rounded-full bg-[#eefbff]" />
                    <p className="text-sm text-[rgba(0,0,0,0.45)]">
                      Loading conversation…
                    </p>
                  </div>
                ) : (
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
                    className="h-full min-h-0 rounded-none border-0 shadow-none"
                    showTemplates={
                      canMessageClient(task) && !isFailedOrCancelled(task)
                    }
                    disabled={!canMessageClient(task)}
                    disabledHint={messageClientHint(task)}
                    onThreadUpdate={handleSelectedThreadUpdate}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-[15px] border border-[#e7e7e7] bg-white">
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
