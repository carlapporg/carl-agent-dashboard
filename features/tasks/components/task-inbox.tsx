"use client";

import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import type { TimelineEvent } from "@/types/message";

type TaskInboxProps = {
  taskId: string;
  timeline: TimelineEvent[];
  quickActions?: string[];
  showTemplates?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  title?: string;
  subtitle?: string;
  clientLabel?: string;
  fillHeight?: boolean;
  className?: string;
};

/** Thin wrapper — prefer TaskChatThread for new screens. */
export function TaskInbox({
  taskId,
  timeline,
  quickActions = [],
  showTemplates,
  disabled,
  disabledHint,
  title,
  subtitle,
  clientLabel,
  fillHeight,
  className,
}: TaskInboxProps) {
  return (
    <TaskChatThread
      taskId={taskId}
      timeline={timeline}
      quickActions={quickActions}
      showTemplates={showTemplates}
      disabled={disabled}
      disabledHint={disabledHint}
      title={title}
      subtitle={subtitle}
      clientLabel={clientLabel}
      fillHeight={fillHeight}
      className={className}
    />
  );
}
