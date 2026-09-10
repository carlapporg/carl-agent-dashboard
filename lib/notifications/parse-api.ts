import type { NotificationItem, NotificationKind } from "@/types/dashboard";

const KINDS: NotificationKind[] = [
  "task_offered",
  "task_assigned",
  "client_message",
  "payment_approved",
  "payment_declined",
  "payment_expired",
  "task_cancelled",
  "task_failed",
  "waiting_for_agent",
  "missed_task",
  "confirmation_confirmed",
  "confirmation_declined",
  "receipt_accepted",
  "receipt_rejected",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function unwrapNotificationList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.notifications)) return record.notifications;
  return [];
}

function normalizeKind(raw: string): NotificationKind {
  if ((KINDS as readonly string[]).includes(raw)) {
    return raw as NotificationKind;
  }
  if (raw.includes("fail") || raw.includes("cancel")) return "task_cancelled";
  return "task_assigned";
}

/** REST / socket notification row → NotificationItem. */
export function parseNotificationItem(row: unknown): NotificationItem | null {
  const record = asRecord(row);
  if (!record) return null;
  if (typeof record.id !== "string" || !record.id) return null;
  if (typeof record.title !== "string" || typeof record.body !== "string") {
    return null;
  }
  if (typeof record.createdAt !== "string") return null;
  const kind =
    typeof record.kind === "string" ? normalizeKind(record.kind) : "task_assigned";
  const panel = record.panel;
  return {
    id: record.id,
    kind,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
    read: record.read === true,
    taskId: typeof record.taskId === "string" ? record.taskId : undefined,
    panel:
      panel === "brief" ||
      panel === "chat" ||
      panel === "payment" ||
      panel === "log" ||
      panel === "receipt"
        ? panel
        : undefined,
  };
}

/** Socket `notification.created` or REST envelope → NotificationItem. */
export function parseNotificationPayload(
  payload: unknown,
): NotificationItem | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return parseNotificationItem(payload[0]);
  const record = asRecord(payload);
  if (!record) return null;
  const nested = record.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return parseNotificationItem(nested) ?? parseNotificationItem(payload);
  }
  if (Array.isArray(nested)) return parseNotificationItem(nested[0]);
  return parseNotificationItem(payload);
}
