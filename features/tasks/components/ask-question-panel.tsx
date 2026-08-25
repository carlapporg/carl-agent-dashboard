"use client";

import { TaskChatThread } from "@/features/tasks/components/task-chat-thread";
import type { TimelineEvent } from "@/types/message";

type AskQuestionPanelProps = {
  taskId: string;
  timeline: TimelineEvent[];
  suggestedQuestions?: string[];
  clientLabel?: string;
  disabled?: boolean;
  disabledHint?: string;
};

export function AskQuestionPanel({
  taskId,
  timeline,
  suggestedQuestions = [],
  clientLabel,
  disabled = false,
  disabledHint,
}: AskQuestionPanelProps) {
  return (
    <TaskChatThread
      taskId={taskId}
      timeline={timeline}
      quickActions={suggestedQuestions}
      showTemplates={false}
      fillHeight={false}
      title="Conversation"
      subtitle={
        clientLabel ? `Ask ${clientLabel} what you need` : "Ask the client what you need"
      }
      clientLabel={clientLabel}
      disabled={disabled}
      disabledHint={disabledHint}
      className="min-h-80"
    />
  );
}
