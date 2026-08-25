import { readLocalJson, writeLocalJson } from "@/lib/tasks/local-store";
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

export function readNotifications(): NotificationItem[] {
  const raw = readLocalJson<unknown>(NOTIFICATION_STORE_KEY, []);
  if (!Array.isArray(raw)) return [];
  const items: NotificationItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const item = parseItem(row);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_NOTIFICATIONS);
}

export function writeNotifications(items: NotificationItem[]) {
  writeLocalJson(
    NOTIFICATION_STORE_KEY,
    items.slice(0, MAX_NOTIFICATIONS),
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
