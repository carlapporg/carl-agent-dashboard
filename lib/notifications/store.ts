import type { NotificationItem, NotificationKind } from "@/types/dashboard";

export const NOTIFICATION_STORE_KEY = "carl.agent.notifications";
export const MAX_NOTIFICATIONS = 80;

const KINDS: NotificationKind[] = [
  "task_offered",
  "task_assigned",
  "client_message",
  "payment_approved",
  "payment_declined",
  "payment_expired",
  "task_cancelled",
  "waiting_for_agent",
  "missed_task",
  "confirmation_confirmed",
  "confirmation_declined",
];

let memoryItems: NotificationItem[] = [];

function isKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && KINDS.includes(value as NotificationKind);
}

function parseItem(value: unknown): NotificationItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  if (typeof row.title !== "string" || typeof row.body !== "string") return null;
  if (typeof row.createdAt !== "string") return null;
  return {
    id: row.id,
    kind: isKind(row.kind) ? row.kind : "task_assigned",
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    read: row.read === true,
    taskId: typeof row.taskId === "string" ? row.taskId : undefined,
    panel:
      row.panel === "payment" ||
      row.panel === "chat" ||
      row.panel === "brief" ||
      row.panel === "log"
        ? row.panel
        : undefined,
  };
}

function dropLegacyStore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NOTIFICATION_STORE_KEY);
  } catch {
    // Private mode / blocked storage.
  }
}

dropLegacyStore();

export function readNotifications(): NotificationItem[] {
  return memoryItems;
}

export function writeNotifications(items: NotificationItem[]) {
  const next: NotificationItem[] = [];
  const seen = new Set<string>();
  for (const row of items.slice(0, MAX_NOTIFICATIONS)) {
    const item = parseItem(row);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  memoryItems = next.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function mergeNotification(
  items: NotificationItem[],
  incoming: NotificationItem,
): NotificationItem[] {
  const next = items.filter((item) => item.id !== incoming.id);
  next.unshift(incoming);
  return next.slice(0, MAX_NOTIFICATIONS);
}
