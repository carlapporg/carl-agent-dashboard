import type { ConversationSummary } from "@/types/dashboard";
import type { Task } from "@/types/task";

function conversationPreview(task: Task): string {
  const summary = task.aiBrief?.summary?.trim();
  if (summary) return summary;
  const request = task.request.trim();
  if (request) return request;
  return "No messages yet";
}

/** Pure mapper — safe for client and server. */
export function taskToConversation(task: Task): ConversationSummary {
  return {
    taskId: task.id,
    taskNumber: task.number,
    taskTitle: task.title,
    taskStatus: task.status,
    lastMessage: conversationPreview(task),
    lastActivityAt: task.updatedAt,
    unreadCount: 0,
  };
}
