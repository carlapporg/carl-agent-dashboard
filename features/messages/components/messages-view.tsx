"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { ConversationSummary } from "@/types/dashboard";
import type { TimelineEvent } from "@/types/message";
import type { Task } from "@/types/task";

type MessagesViewProps = {
  conversations: ConversationSummary[];
  timelines: Record<string, TimelineEvent[]>;
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
  timelines,
  tasks,
}: MessagesViewProps) {
  const [selectedId, setSelectedId] = useState(
    conversations[0]?.taskId ?? null,
  );
  const selected = useMemo(
    () => conversations.find((c) => c.taskId === selectedId) ?? null,
    [conversations, selectedId],
  );
  const task = selectedId ? tasks[selectedId] : null;
  const timeline = selectedId ? (timelines[selectedId] ?? []) : [];

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="When clients message on your tasks, threads show up here."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {conversations.map((c) => {
            const active = c.taskId === selectedId;
            return (
              <li key={c.taskId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.taskId)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                    active ? "bg-accent/5" : "hover:bg-accent/[0.04]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      #{c.taskNumber} {c.taskTitle}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {formatRel(c.lastActivityAt)}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm text-muted">
                    {c.lastMessage}
                  </p>
                  {c.unreadCount > 0 ? (
                    <span className="mt-0.5 w-fit rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      {c.unreadCount} unread
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="space-y-3">
        {selected && task ? (
          <>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    #{task.number} {task.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {task.aiBrief?.summary ?? task.request}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.status} />
                  <Link
                    href={ROUTES.taskPanel(task.id, "chat")}
                    className="text-sm font-semibold text-accent hover:text-accent-hover"
                  >
                    Open workspace
                  </Link>
                </div>
              </div>
            </Card>
            <TaskChatThread
              taskId={selected.taskId}
              timeline={timeline}
              quickActions={task.aiBrief?.missingInfo ?? []}
            />
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
