"use client";

import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import type { TimelineEvent } from "@/types/message";

type TaskInboxProps = {
  taskId: string;
  timeline: TimelineEvent[];
  quickActions?: string[];
};

/** Thin wrapper — prefer TaskChatThread for new screens. */
export function TaskInbox({
  taskId,
  timeline,
  quickActions = [],
}: TaskInboxProps) {
  return (
    <TaskChatThread
      taskId={taskId}
      timeline={timeline}
      quickActions={quickActions}
    />
  );
}
