import { z } from "zod";

export const agentPresenceSchema = z.enum([
  "AVAILABLE",
  "ONLINE",
  "BUSY",
  "OFFLINE",
]);

export type AgentPresence = z.infer<typeof agentPresenceSchema>;

export const agentPresenceWriteSchema = agentPresenceSchema;

export type AgentPresenceWrite = AgentPresence;

export const agentPresenceStateSchema = z
  .object({
    userId: z.string().optional(),
    status: agentPresenceSchema,
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
  alias: z.string(),
  firstName: z.string().nullable().optional(),
});

export const agentTaskSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    status: agentTaskStatusSchema,
    title: z.string(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    assignedAgentId: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable().optional(),
    client: agentClientSchema.optional(),
  })
  .passthrough();

export type AgentTask = z.infer<typeof agentTaskSchema>;

export const agentTaskListSchema = z.array(agentTaskSchema);

export const taskMessageSenderSchema = z.enum([
  "USER",
  "AI",
  "AGENT",
  "SYSTEM",
]);

export const agentTaskMessageSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  sender: taskMessageSenderSchema,
  senderId: z.string().nullable().optional(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type AgentTaskMessage = z.infer<typeof agentTaskMessageSchema>;

export const agentTaskMessageListSchema = z.array(agentTaskMessageSchema);

export const REJECT_WINDOW_MS = 60_000;

export function rejectDeadlineIso(assignedAtIso: string): string {
  return new Date(new Date(assignedAtIso).getTime() + REJECT_WINDOW_MS).toISOString();
}

export function isRejectWindowOpen(
  assignedAtIso: string,
  now = Date.now(),
): boolean {
  return now < new Date(assignedAtIso).getTime() + REJECT_WINDOW_MS;
}
