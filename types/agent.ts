import { z } from "zod";

export const agentPresenceSchema = z.enum([
  "AVAILABLE",
  "BUSY",
  "OFFLINE",
]);

export type AgentPresence = z.infer<typeof agentPresenceSchema>;

export const agentPresenceWriteSchema = agentPresenceSchema;

export type AgentPresenceWrite = AgentPresence;

export const agentPresenceStateSchema = z
  .object({
    userId: z.string().optional(),
    status: z.preprocess(
      (value) => (value === "ONLINE" ? "AVAILABLE" : value),
      agentPresenceSchema,
    ),
    isGeneralist: z.boolean().optional(),
    currentTaskId: z.string().nullable().optional(),
    socketId: z.string().nullable().optional(),
    lastSeenAt: z.string().nullable().optional(),
    lastAssignedAt: z.string().nullable().optional(),
    activeTaskCount: z.number().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export type AgentPresenceState = z.infer<typeof agentPresenceStateSchema>;

export const agentSkillsStateSchema = z.object({
  isGeneralist: z.boolean(),
  skills: z.array(z.string()),
});

export type AgentSkillsState = z.infer<typeof agentSkillsStateSchema>;

export const inboxFilterSchema = z.enum(["OFFERED", "ACTIVE", "HISTORY"]);
export type InboxFilter = z.infer<typeof inboxFilterSchema>;

export const agentTaskStatusSchema = z.enum([
  "QUEUED",
  "OFFERED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_AGENT",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);

export type AgentTaskStatus = z.infer<typeof agentTaskStatusSchema>;

export function isInProgressStatus(status?: string | null): boolean {
  return status === "IN_PROGRESS";
}

export const agentClientSchema = z.object({
  alias: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const next = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return next || undefined;
}

function coerceIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return coerceIso(Number(trimmed));
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

function unwrapTaskRow(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const nested =
    asRecord(data.task) ?? asRecord(data.offer) ?? asRecord(root.task);
  if (nested && (nested.id != null || nested.taskId != null || nested._id != null)) {
    return nested;
  }
  if (data.id != null || data.taskId != null || data._id != null) {
    return data;
  }
  return root;
}

export const agentTaskSchema = z
  .preprocess(
    (value) => {
      const row = unwrapTaskRow(value);
      if (!row) return value;
      return {
        ...row,
        id: row.id ?? row.taskId ?? row._id,
        status:
          normalizeStatus(row.status) ??
          normalizeStatus(row.taskStatus) ??
          normalizeStatus(row.state),
        rejectUntil:
          coerceIso(row.rejectUntil) ??
          coerceIso(row.offerExpiresAt) ??
          coerceIso(row.expiresAt) ??
          row.rejectUntil,
        createdAt: coerceIso(row.createdAt) ?? row.createdAt ?? "",
        updatedAt:
          coerceIso(row.updatedAt) ??
          coerceIso(row.createdAt) ??
          row.updatedAt ??
          "",
      };
    },
    z
      .object({
        id: z.union([z.string(), z.number()]).transform(String),
        type: z.string().optional().default("TASK"),
        status: z.string().optional(),
        title: z.string().optional().default("Task"),
        description: z.string().nullable().optional(),
        metadata: z.unknown().nullable().optional(),
        assignedAgentId: z.string().nullable().optional(),
        createdAt: z.string().optional().default(""),
        updatedAt: z.string().optional().default(""),
        completedAt: z.string().nullable().optional(),
        canReject: z.boolean().optional(),
        rejectUntil: z.string().nullable().optional(),
        client: agentClientSchema.nullable().optional(),
      })
      .passthrough(),
  );

export type AgentTask = z.infer<typeof agentTaskSchema>;

export const agentTaskListSchema = z.array(agentTaskSchema);

export const taskMessageSenderSchema = z.enum([
  "USER",
  "AI",
  "AGENT",
  "SYSTEM",
]);

export const agentTaskMessageSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    taskId: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    sender: z.string().optional().default("AGENT"),
    senderId: z.string().nullable().optional(),
    content: z.string().optional().default(""),
    messageType: z.string().optional(),
    durationMs: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value == null || value === "") return null;
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }),
    mimeType: z.string().nullable().optional(),
    audioUrl: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    metadata: z.unknown().nullable().optional(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string().optional().default(""),
  })
  .passthrough();

export type AgentTaskMessage = z.infer<typeof agentTaskMessageSchema>;

export const agentTaskMessageListSchema = z.array(agentTaskMessageSchema);

export const REJECT_WINDOW_MS = 30_000;

export function rejectDeadlineIso(assignedAtIso: string): string {
  return new Date(new Date(assignedAtIso).getTime() + REJECT_WINDOW_MS).toISOString();
}

export function offerWindowEnd(task: {
  expiresAt?: string;
  rejectUntil?: string | null;
  updatedAt?: string;
  createdAt?: string;
}): string {
  for (const value of [task.expiresAt, task.rejectUntil, undefined]) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  const base = task.updatedAt || task.createdAt;
  if (base && Number.isFinite(new Date(base).getTime())) {
    return rejectDeadlineIso(base);
  }
  return rejectDeadlineIso(new Date().toISOString());
}

export function isRejectWindowOpen(
  assignedAtIso: string,
  now = Date.now(),
): boolean {
  return now < new Date(assignedAtIso).getTime() + REJECT_WINDOW_MS;
}

export function isOfferedTask(task: { backendStatus?: string }): boolean {
  return task.backendStatus === "OFFERED";
}

export function isAssignedPendingStart(task: {
  backendStatus?: string;
}): boolean {
  return task.backendStatus === "ASSIGNED";
}

/** First offer only. Nest status OFFERED — do not infer from a local timer. */
export function canRejectOffer(task: { backendStatus?: string }): boolean {
  return task.backendStatus === "OFFERED";
}
