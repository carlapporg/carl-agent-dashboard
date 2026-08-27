"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { listTaskMessagesAction } from "@/features/tasks/actions/task-actions";
import {
  shouldHideRejectedOffer,
  useRejectedOfferTick,
} from "@/features/ops/rejected-offers";
import {
  canMessageClient,
  isFailedOrCancelled,
  messageClientHint,
} from "@/features/tasks/lib/workflow";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
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
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function MessagesView({
  conversations,
  tasks,
}: MessagesViewProps) {
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
  const loadedIds = useRef(new Set<string>());

  const selected = useMemo(
    () => visibleConversations.find((c) => c.taskId === selectedId) ?? null,
    [visibleConversations, selectedId],
  );
  const task = selectedId ? tasks[selectedId] : null;
  const timeline = selectedId ? (timelines[selectedId] ?? []) : [];
  const chatReady = selectedId != null && Object.hasOwn(timelines, selectedId);

  useEffect(() => {
    if (!selectedId) return;
    if (loadedIds.current.has(selectedId)) return;
    const taskId = selectedId;
    let cancelled = false;
    void listTaskMessagesAction(taskId).then((events) => {
      if (cancelled) return;
      loadedIds.current.add(taskId);
      setTimelines((prev) => ({ ...prev, [taskId]: events }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (visibleConversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="When clients message on your tasks, threads show up here."
      />
    );
  }

  return (
    <div className="grid min-h-128 gap-4 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.35fr)] lg:items-stretch">
      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Inbox</p>
          <p className="text-[11px] text-muted">
            {visibleConversations.length} conversation
            {visibleConversations.length === 1 ? "" : "s"}
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visibleConversations.map((c) => {
            const active = c.taskId === selectedId;
            const rowTask = tasks[c.taskId];
            return (
              <li key={c.taskId} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(c.taskId)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
                    active ? "bg-accent/5" : "hover:bg-accent/4",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      c.unreadCount > 0 ? "bg-accent" : "bg-transparent",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        #{c.taskNumber} {c.taskTitle}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">
                        {formatRel(c.lastActivityAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[12px] text-muted">
                      {rowTask?.customerName ? `${rowTask.customerName} · ` : ""}
                      {c.lastMessage}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex min-h-112 flex-col gap-2 lg:min-h-0">
        {selected && task ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-border bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  #{task.number} {task.title}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {task.customerName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={task.status} />
                <Link
                  href={ROUTES.taskPanel(task.id, "chat")}
                  className="text-xs font-semibold text-accent hover:text-accent-hover"
                >
                  Open workspace
                </Link>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {!chatReady ? (
                <div className="flex h-full min-h-64 items-center justify-center rounded-(--radius-card) border border-border bg-surface text-sm text-muted">
                  Loading conversation…
                </div>
              ) : (
                <TaskChatThread
                  taskId={selected.taskId}
                  timeline={timeline}
                  quickActions={task.aiBrief?.missingInfo ?? []}
                  title="Conversation"
                  subtitle={`With ${task.customerName}`}
                  clientLabel={task.customerName}
                  fillHeight={false}
                  className="h-full min-h-0"
                  showTemplates={
                    canMessageClient(task) && !isFailedOrCancelled(task)
                  }
                  disabled={!canMessageClient(task)}
                  disabledHint={messageClientHint(task)}
                />
              )}
            </div>
          </>
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
