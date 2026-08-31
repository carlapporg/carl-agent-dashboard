import { ROUTES } from "@/lib/constants/routes";
import { parseTaskConfirmationPayload } from "@/types/confirmation";
import { parseTaskReceiptPayload } from "@/types/receipt";
import type { NotificationItem, NotificationKind } from "@/types/dashboard";
import type { Task } from "@/types/task";

export type NotificationDraft = Omit<NotificationItem, "read">;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nested(value: unknown, key: string): Record<string, unknown> | null {
  const root = asRecord(value);
  return root ? asRecord(root[key]) : null;
}

export function hrefForNotification(item: Pick<NotificationItem, "taskId" | "panel">) {
  if (item.taskId && item.panel) return ROUTES.taskPanel(item.taskId, item.panel);
  if (item.taskId) return ROUTES.task(item.taskId);
  return ROUTES.notifications;
}

export function kindLabel(kind: NotificationKind): string {
  switch (kind) {
    case "task_offered":
      return "New offer";
    case "task_assigned":
      return "Assigned";
    case "client_message":
      return "Message";
    case "payment_approved":
      return "Payment approved";
    case "payment_declined":
      return "Payment declined";
    case "payment_expired":
      return "Payment expired";
    case "task_cancelled":
      return "Failed";
    case "waiting_for_agent":
      return "Needs you";
    case "missed_task":
      return "Missed";
    case "confirmation_confirmed":
      return "Details confirmed";
    case "confirmation_declined":
      return "Details declined";
    case "receipt_accepted":
      return "Receipt accepted";
    case "receipt_rejected":
      return "Receipt rejected";
    default:
      return "Update";
  }
}

export function notificationFromOffer(task: Task): NotificationDraft {
  const offered = task.backendStatus === "OFFERED";
  return {
    id: `offer:${task.id}`,
    kind: offered ? "task_offered" : "task_assigned",
    title: offered ? "New task offered" : "Task assigned to you",
    body: task.title || "A task is waiting for you.",
    createdAt: task.updatedAt || new Date().toISOString(),
    taskId: task.id,
    panel: "brief",
  };
}

export function notificationFromClientMessage(input: {
  taskId: string;
  content: string;
  clientLabel: string;
  taskTitle?: string;
  messageId?: string;
}): NotificationDraft {
  const preview =
    input.content.length > 90
      ? `${input.content.slice(0, 87)}…`
      : input.content;
  return {
    id: `msg:${input.taskId}:${input.messageId ?? Date.now()}`,
    kind: "client_message",
    title: `${input.clientLabel} sent a message`,
    body: input.taskTitle ? `${preview} · ${input.taskTitle}` : preview,
    createdAt: new Date().toISOString(),
    taskId: input.taskId,
    panel: "chat",
  };
}

export function parsePaymentNotification(
  payload: unknown,
  kind: Extract<
    NotificationKind,
    "payment_approved" | "payment_declined" | "payment_expired"
  >,
): NotificationDraft | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const taskId =
    str(data.taskId) ?? str(nested(data, "task")?.id) ?? str(root.taskId);
  if (!taskId) return null;
  const merchant = str(data.merchant) ?? "the client";
  const amount =
    typeof data.amount === "number"
      ? data.amount
      : typeof data.approvedAmount === "number"
        ? data.approvedAmount
        : null;
  const amountText =
    amount != null ? ` (${amount.toLocaleString()})` : "";
  const titles = {
    payment_approved: "Payment approved",
    payment_declined: "Payment declined",
    payment_expired: "Payment request expired",
  } as const;
  const bodies = {
    payment_approved: `${merchant} approved the payment request${amountText}.`,
    payment_declined: `${merchant} declined the payment request.`,
    payment_expired: `The payment request for ${merchant} expired.`,
  } as const;
  const authId = str(data.authorizationId) ?? str(data.id) ?? kind;
  return {
    id: `${kind}:${taskId}:${authId}`,
    kind,
    title: titles[kind],
    body: bodies[kind],
    createdAt: str(data.updatedAt) ?? new Date().toISOString(),
    taskId,
    panel: "payment",
  };
}

export function parseCancelledNotification(payload: unknown): NotificationDraft | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const taskId =
    str(data?.taskId) ?? str(nested(data, "task")?.id) ?? str(root?.taskId);
  if (!taskId) return null;
  const title =
    str(data?.title) ?? str(nested(data, "task")?.title) ?? "A task failed.";
  return {
    id: `cancelled:${taskId}`,
    kind: "task_cancelled",
    title: "Task failed",
    body: title,
    createdAt: new Date().toISOString(),
    taskId,
    panel: "brief",
  };
}

export function parseWaitingForAgent(payload: unknown): NotificationDraft | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const status =
    str(data?.status) ??
    str(nested(data, "task")?.status) ??
    str(root?.status);
  if (status !== "WAITING_FOR_AGENT") return null;
  const taskId =
    str(data?.taskId) ?? str(nested(data, "task")?.id) ?? str(root?.taskId);
  if (!taskId) return null;
  const title =
    str(data?.title) ?? str(nested(data, "task")?.title) ?? "A task needs you.";
  return {
    id: `waiting:${taskId}`,
    kind: "waiting_for_agent",
    title: "Client is waiting for you",
    body: title,
    createdAt: new Date().toISOString(),
    taskId,
    panel: "chat",
  };
}

export function parseConfirmationNotification(
  payload: unknown,
  kind: Extract<
    NotificationKind,
    "confirmation_confirmed" | "confirmation_declined"
  >,
): NotificationDraft | null {
  const parsed = parseTaskConfirmationPayload(payload);
  const taskId = parsed?.taskId;
  if (!taskId) return null;
  const cost = parsed.costDisplay?.trim() || parsed.cost || "";
  return {
    id: `${kind}:${taskId}:${parsed.id}`,
    kind,
    title:
      kind === "confirmation_confirmed"
        ? "User confirmed the details"
        : "User declined the details",
    body: cost || parsed.summary || parsed.title || "Open the task to continue.",
    createdAt: parsed.decidedAt ?? parsed.updatedAt ?? new Date().toISOString(),
    taskId,
    panel: "brief",
  };
}

export function parseReceiptNotification(
  payload: unknown,
  kind: Extract<NotificationKind, "receipt_accepted" | "receipt_rejected">,
): NotificationDraft | null {
  const parsed = parseTaskReceiptPayload(payload);
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const taskId =
    parsed?.taskId ??
    str(data?.taskId) ??
    str(nested(data, "task")?.id) ??
    str(root?.taskId);
  if (!taskId) return null;
  const receiptId =
    parsed?.id ?? str(data?.receiptId) ?? str(data?.id) ?? kind;
  const rejectReason = parsed?.rejectReason?.trim() || str(data?.rejectReason);
  const truncatedReason =
    rejectReason && rejectReason.length > 90
      ? `${rejectReason.slice(0, 87)}…`
      : rejectReason;
  return {
    id: `${kind}:${taskId}:${receiptId}`,
    kind,
    title:
      kind === "receipt_accepted"
        ? "User accepted the receipt"
        : "User rejected the receipt",
    body:
      kind === "receipt_accepted"
        ? "You can complete the task now."
        : truncatedReason || "Upload a new receipt.",
    createdAt:
      parsed?.decidedAt ?? parsed?.updatedAt ?? new Date().toISOString(),
    taskId,
    panel: "receipt",
  };
}

export function parseMissedTask(payload: unknown): NotificationDraft | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const taskId =
    str(data?.taskId) ?? str(nested(data, "task")?.id) ?? str(root?.taskId);
  if (!taskId) return null;
  const title =
    str(data?.title) ?? str(nested(data, "task")?.title) ?? "An offer expired.";
  return {
    id: `missed:${taskId}`,
    kind: "missed_task",
    title: "Offer expired",
    body: title,
    createdAt: new Date().toISOString(),
    taskId,
    panel: "brief",
  };
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < 45_000) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.round(diff / day))}d ago`;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
