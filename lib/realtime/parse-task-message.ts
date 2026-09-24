import { mediaKindFromMessage } from "@/lib/api/map-task";
import { agentTaskMessageSchema } from "@/types/agent";
import type { ChatMediaKind } from "@/types/message";
import { receiptStatusFromMessage } from "@/lib/realtime/parse-message-receipt";
import { isVenuePickedMessageMetadata } from "@/types/venue";

export type IncomingTaskMessage = {
  taskId: string;
  sender: string;
  content: string;
  clientLabel: string;
  taskTitle?: string;
  messageId?: string;
  mediaKind: ChatMediaKind;
  durationMs?: number | null;
  metadata?: unknown;
  receiptStatus?: "SENT" | "DELIVERED" | "SEEN";
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
  if (isVenuePickedMessageMetadata(message.metadata)) {
    return "Customer selected a place";
  }
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
  const metadata = parsed.success
    ? parsed.data.metadata
    : (message.metadata ?? data.metadata ?? null);
  const mediaKind = parsed.success
    ? mediaKindFromMessage(parsed.data)
    : "text";
  if (!taskId) return null;
  if (!content && mediaKind === "text" && !isVenuePickedMessageMetadata(metadata)) {
    return null;
  }

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
    metadata,
    receiptStatus: parsed.success
      ? receiptStatusFromMessage(parsed.data)
      : receiptStatusFromMessage({
          status: typeof message.status === "string" ? message.status : null,
          receiptStatus:
            typeof message.receiptStatus === "string"
              ? message.receiptStatus
              : null,
          deliveredAt:
            typeof message.deliveredAt === "string"
              ? message.deliveredAt
              : null,
          seenAt: typeof message.seenAt === "string" ? message.seenAt : null,
          readAt: typeof message.readAt === "string" ? message.readAt : null,
        }),
  };
}
