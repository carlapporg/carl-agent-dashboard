import { z } from "zod";

export const taskStatusSchema = z.enum([
  "queued",
  "assigned",
  "in_progress",
  "waiting_for_customer",
  "waiting_for_payment",
  "completed",
  "cancelled",
  "failed",
]);

export const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const aiBriefSchema = z.object({
  summary: z.string(),
  missingInfo: z.array(z.string()).default([]),
  suggestedActions: z.array(z.string()).default([]),
});

export const taskNoteSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  authorName: z.string(),
});

export const taskSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  request: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  customerId: z.string(),
  customerName: z.string(),
  parentId: z.string().nullable().optional(),
  childIds: z.array(z.string()).default([]),
  assignedAgentId: z.string().nullable().optional(),
  aiBrief: aiBriefSchema.optional(),
  notes: z.array(taskNoteSchema).default([]),
  suggestedStepsDone: z.array(z.string()).default([]),
  /** When true, workflow includes Awaiting Payment and shows Payment section */
  requiresPayment: z.boolean().optional(),
  /** Server-authoritative assignment SLA (ISO). Optional until Backend ships. */
  expiresAt: z.string().optional(),
  taskType: z.string().optional(),
  tier: z.enum(["standard", "vip", "family"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  /** Nest task.status when loaded from API */
  backendStatus: z
    .enum([
      "ASSIGNED",
      "IN_PROGRESS",
      "WAITING_FOR_USER",
      "WAITING_FOR_AGENT",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "REJECTED",
    ])
    .optional(),
  clientAlias: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type AiBrief = z.infer<typeof aiBriefSchema>;
export type TaskNote = z.infer<typeof taskNoteSchema>;
export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.array(taskSchema);

export type TaskListFilters = {
  status?: TaskStatus | "all";
  waitingOn?: "customer" | "payment" | "all";
  search?: string;
};
