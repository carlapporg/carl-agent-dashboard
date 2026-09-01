"use client";



import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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



function formatRel(value: string): string {

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

    if (!q) return displayConversations;

    return displayConversations.filter((c) => {

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

        kind: live.sender === "USER" ? "customer_message" : "agent_message",

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
      const sig = threadSignature(thread);
      setTimelines((prev) => {
        const current = prev[taskId];
        if (current && threadSignature(current) === sig) return prev;
        return { ...prev, [taskId]: thread };
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

      <EmptyState

        title="No conversations yet"

        description="When clients message on your tasks, threads show up here."

      />

    );

  }



  const bookingRef = task ? bookingRefs[task.id] : null;

  const assignedToYou =

    task != null &&

    (task.backendStatus === "ASSIGNED" ||

      task.backendStatus === "IN_PROGRESS" ||

      task.backendStatus === "WAITING_FOR_AGENT" ||

      task.backendStatus === "WAITING_FOR_USER" ||

      task.status === "assigned" ||

      task.status === "in_progress" ||

      task.status === "waiting_for_customer");



  return (

    <div className="grid min-h-[calc(100dvh-11rem)] gap-5 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1.55fr)] lg:items-stretch">

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">

          <h2 className="text-base font-bold text-foreground">Conversations</h2>

          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">

            {filtered.length} Active

          </span>

        </div>



        <div className="shrink-0 px-4 pb-4 pt-1">

          <div className="relative">

            <span

              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-dim"

              aria-hidden

            >

              <svg

                width="16"

                height="16"

                viewBox="0 0 24 24"

                fill="none"

                stroke="currentColor"

                strokeWidth="2"

                strokeLinecap="round"

              >

                <circle cx="11" cy="11" r="7" />

                <path d="m20 20-3.5-3.5" />

              </svg>

            </span>

            <input

              value={filter}

              onChange={(event) => setFilter(event.target.value)}

              placeholder="Filter chats..."

              aria-label="Filter chats"

              className="h-10 w-full rounded-[var(--radius-md)] border-0 bg-surface-hover pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-dim focus-visible:ring-2 focus-visible:ring-accent/20"

            />

          </div>

        </div>



        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">

          {filtered.map((c) => {

            const active = c.taskId === selectedId;

            const rowTask = tasks[c.taskId];

            const customerName = rowTask?.customerName ?? `Task #${c.taskNumber}`;

            return (

              <li key={c.taskId}>

                <button

                  type="button"

                  onClick={() => setSelectedId(c.taskId)}

                  className={cn(

                    "w-full rounded-[var(--radius-md)] border px-4 py-3.5 text-left transition-colors",

                    active

                      ? "border-accent bg-accent-soft"

                      : "border-border bg-surface hover:bg-surface-hover",

                  )}

                >

                  <span className="flex items-start justify-between gap-3">

                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-sm font-bold text-foreground">

                        {customerName}

                      </span>

                      <span className="mt-1 line-clamp-2 block text-sm leading-snug text-muted">

                        {c.lastMessage}

                      </span>

                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">

                      <span className="text-xs tabular-nums text-muted">

                        {formatRel(c.lastActivityAt)}

                      </span>

                      {c.unreadCount > 0 ? (

                        <span

                          className="size-2 rounded-full bg-accent"

                          aria-label="Unread"

                        />

                      ) : null}

                    </span>

                  </span>

                </button>

              </li>

            );

          })}

        </ul>

      </aside>



      <div className="flex min-h-[28rem] flex-col lg:min-h-0">

        {selected && task ? (

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">

            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">

              <div className="min-w-0">

                <h3 className="truncate text-lg font-bold text-foreground">

                  {task.customerName}

                </h3>

                <p className="mt-0.5 truncate text-sm text-muted">

                  {bookingRef

                    ? `Booking Ref: ${formatBookingRef(bookingRef)} · `

                    : null}

                  Ticket #T-{task.number}

                </p>

              </div>

              <div className="flex flex-wrap items-center gap-3">

                {assignedToYou ? (

                  <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-foreground">

                    Assigned to You

                  </span>

                ) : null}

                <Link

                  href={ROUTES.taskPanel(task.id, "chat")}

                  className="text-sm font-semibold text-accent hover:text-accent-hover"

                >

                  Open workspace

                </Link>

              </div>

            </header>



            <div className="min-h-0 flex-1">

              {!chatReady ? (

                <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">

                  <span className="size-8 animate-pulse rounded-full bg-accent-soft" />

                  <p className="text-sm text-muted">Loading conversation…</p>

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

                  className="h-full min-h-0 border-0 shadow-none"

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

          <EmptyState

            title="Select a conversation"

            description="Pick a thread on the left to reply."

          />

        )}

      </div>

    </div>

  );

}


