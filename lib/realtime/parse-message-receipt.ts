import type { MessageReceiptStatus } from "@/types/message";

const RANK: Record<MessageReceiptStatus, number> = {
  SENT: 0,
  DELIVERED: 1,
  SEEN: 2,
};

export function parseReceiptStatus(raw: unknown): MessageReceiptStatus | null {
  if (raw === "SENT" || raw === "DELIVERED" || raw === "SEEN") return raw;
  if (typeof raw === "string") {
    const upper = raw.toUpperCase();
    if (upper === "SENT" || upper === "DELIVERED" || upper === "SEEN") {
      return upper;
    }
    if (upper === "READ") return "SEEN";
  }
  return null;
}

/** Forward-only merge (never SEEN → DELIVERED). */
export function mergeReceiptStatus(
  current: MessageReceiptStatus | null | undefined,
  next: MessageReceiptStatus | null | undefined,
): MessageReceiptStatus {
  const a = current ?? "SENT";
  const b = next ?? "SENT";
  return RANK[b] >= RANK[a] ? b : a;
}

export function receiptStatusFromMessage(input: {
  status?: string | null;
  receiptStatus?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  readAt?: string | null;
}): MessageReceiptStatus {
  const fromField =
    parseReceiptStatus(input.receiptStatus) ??
    parseReceiptStatus(input.status);
  if (fromField) return fromField;
  if (input.seenAt || input.readAt) return "SEEN";
  if (input.deliveredAt) return "DELIVERED";
  return "SENT";
}

export type MessageReceiptEvent = {
  taskId: string;
  messageIds: string[];
  status: "DELIVERED" | "SEEN";
  deliveredAt?: string;
  seenAt?: string;
  readAt?: string;
  reader: "USER" | "AGENT";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function parseMessageReceiptPayload(
  payload: unknown,
): MessageReceiptEvent | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const taskId =
    typeof data.taskId === "string"
      ? data.taskId
      : typeof root.taskId === "string"
        ? root.taskId
        : null;
  if (!taskId) return null;

  const statusRaw = data.status ?? root.status;
  let status: "DELIVERED" | "SEEN" | null = null;
  if (statusRaw === "DELIVERED" || statusRaw === "SEEN") status = statusRaw;
  else if (statusRaw === "READ") status = "SEEN";

  const readerRaw = data.reader ?? root.reader;
  const reader =
    readerRaw === "USER" || readerRaw === "AGENT" ? readerRaw : null;

  const ids = Array.isArray(data.messageIds)
    ? data.messageIds.filter((id): id is string => typeof id === "string")
    : Array.isArray(root.messageIds)
      ? root.messageIds.filter((id): id is string => typeof id === "string")
      : [];

  // Legacy message.read often omits status.
  if (!status && (data.readAt || data.seenAt || root.readAt)) {
    status = "SEEN";
  }
  if (!status) return null;
  if (!reader) {
    // message.read without reader → treat as USER (client saw agent msgs).
    if (status === "SEEN") {
      return {
        taskId,
        messageIds: ids,
        status: "SEEN",
        seenAt:
          typeof data.seenAt === "string"
            ? data.seenAt
            : typeof data.readAt === "string"
              ? data.readAt
              : undefined,
        readAt:
          typeof data.readAt === "string"
            ? data.readAt
            : typeof data.seenAt === "string"
              ? data.seenAt
              : undefined,
        reader: "USER",
      };
    }
    return null;
  }

  return {
    taskId,
    messageIds: ids,
    status,
    deliveredAt:
      typeof data.deliveredAt === "string" ? data.deliveredAt : undefined,
    seenAt:
      typeof data.seenAt === "string"
        ? data.seenAt
        : typeof data.readAt === "string"
          ? data.readAt
          : undefined,
    readAt:
      typeof data.readAt === "string"
        ? data.readAt
        : typeof data.seenAt === "string"
          ? data.seenAt
          : undefined,
    reader,
  };
}
