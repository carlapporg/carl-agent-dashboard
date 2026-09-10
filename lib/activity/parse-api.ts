export type ActivityLogKind =
  | "task_status"
  | "payment"
  | "handover"
  | "system"
  | "alert"
  | "voucher";

export type ActivityLogFilter = "all" | "system" | "handover";

export type ActivityLogItem = {
  id: string;
  kind: ActivityLogKind;
  title: string;
  body: string;
  taskLabel: string | null;
  actor: string | null;
  at: string;
  taskId: string | null;
};

const KINDS = [
  "task_status",
  "payment",
  "handover",
  "system",
  "alert",
  "voucher",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function unwrapActivityList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.logs)) return record.logs;
  return [];
}

function normalizeKind(raw: string): ActivityLogKind {
  if ((KINDS as readonly string[]).includes(raw)) {
    return raw as ActivityLogKind;
  }
  return "task_status";
}

/** REST / socket activity row → ActivityLogItem. */
export function parseActivityItem(row: unknown): ActivityLogItem | null {
  const record = asRecord(row);
  if (!record) return null;
  if (typeof record.id !== "string" || !record.id) return null;
  if (typeof record.title !== "string" || typeof record.body !== "string") {
    return null;
  }
  if (typeof record.at !== "string") return null;
  return {
    id: record.id,
    kind:
      typeof record.kind === "string"
        ? normalizeKind(record.kind)
        : "task_status",
    title: record.title,
    body: record.body,
    taskLabel:
      typeof record.taskLabel === "string"
        ? record.taskLabel
        : record.taskLabel === null
          ? null
          : null,
    actor:
      typeof record.actor === "string"
        ? record.actor
        : record.actor === null
          ? null
          : null,
    at: record.at,
    taskId:
      typeof record.taskId === "string"
        ? record.taskId
        : record.taskId === null
          ? null
          : null,
  };
}

/** Socket `activity.created` or REST envelope → ActivityLogItem. */
export function parseActivityPayload(
  payload: unknown,
): ActivityLogItem | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return parseActivityItem(payload[0]);
  const record = asRecord(payload);
  if (!record) return null;
  const nested = record.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return parseActivityItem(nested) ?? parseActivityItem(payload);
  }
  if (Array.isArray(nested)) return parseActivityItem(nested[0]);
  return parseActivityItem(payload);
}
