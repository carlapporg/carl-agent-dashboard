import { mediaKindFromMessage } from "@/lib/api/map-task";
import { agentTaskMessageSchema } from "@/types/agent";
import type { ChatMediaKind } from "@/types/message";

export type IncomingTaskMessage = {
  taskId: string;
  sender: string;
  content: string;
  clientLabel: string;
  taskTitle?: string;
  messageId?: string;
  mediaKind: ChatMediaKind;
  durationMs?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function labelFromClient(value: unknown): string | undefined {
  const client = asRecord(value);
  if (!client) return undefined;
  if (typeof client.firstName === "string" && client.firstName.trim()) {
    return client.firstName;
  }
  if (typeof client.alias === "string" && client.alias.trim()) {
    return client.alias;
  }
  if (typeof client.handle === "string" && client.handle.trim()) {
    return client.handle;
  }
  return undefined;
}

export function previewForIncomingMessage(message: IncomingTaskMessage): string {
  if (message.mediaKind === "voice") return "Voice message";
  if (message.mediaKind === "image") {
    return message.content.trim() || "Photo";
  }
  return message.content;
}

export function parseIncomingTaskMessage(
  payload: unknown,
): IncomingTaskMessage | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const message = asRecord(data.message) ?? data;
  const parsed = agentTaskMessageSchema.safeParse(message);
  const taskId =
    (parsed.success ? parsed.data.taskId : null) ??
    (typeof data.taskId === "string" ? data.taskId : null) ??
    (typeof message.taskId === "string" ? message.taskId : null);
  const content =
    (parsed.success ? parsed.data.content : null) ??
    (typeof message.content === "string" ? message.content : null) ??
    (typeof data.content === "string" ? data.content : null) ??
    "";
  const mediaKind = parsed.success
    ? mediaKindFromMessage(parsed.data)
    : "text";
  if (!taskId) return null;
  if (!content && mediaKind === "text") return null;

  const sender =
    (parsed.success ? parsed.data.sender : null) ??
    (typeof message.sender === "string" ? message.sender : "USER");
  const task = asRecord(data.task);
  const taskTitle =
    (typeof data.taskTitle === "string" && data.taskTitle) ||
    (typeof data.title === "string" && data.title) ||
    (typeof task?.title === "string" && task.title) ||
    undefined;

  return {
    taskId,
    sender,
    content,
    clientLabel:
      labelFromClient(data.client) ??
      labelFromClient(task?.client) ??
      "Client",
    taskTitle,
    messageId: parsed.success ? parsed.data.id : undefined,
    mediaKind,
    durationMs: parsed.success ? parsed.data.durationMs : null,
  };
}
