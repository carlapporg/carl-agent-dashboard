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

/** Loyalty membership when the user consented to use a saved program on this task. */
export const taskMembershipSchema = z.object({
  brand: z.string().min(1),
  membershipId: z.string().min(1),
});

export type TaskMembership = z.infer<typeof taskMembershipSchema>;

/** Nested on Task for confirmation UI — mirrors Nest confirmationSchema. */
export const taskConfirmationFormSchema = z.object({
  taskType: z.string().optional(),
  costRequired: z.boolean().optional().default(true),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        required: z.boolean().optional().default(false),
        prefillFrom: z.array(z.string()).optional(),
      }),
    )
    .default([]),
});

export type TaskConfirmationFormSchema = z.infer<
  typeof taskConfirmationFormSchema
>;

export const taskSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  code: z.string().optional(),
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
  /** Nest `taskType` / `type` — drive confirmation form; do not hardcode. */
  taskType: z.string().optional(),
  tier: z.enum(["standard", "vip", "family"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  /** Nest task.status when loaded from API */
  backendStatus: z
    .enum([
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
    ])
    .optional(),
  clientAlias: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  /**
   * Loyalty membership the user agreed to use for this booking.
   * Top-level `membership` only — never metadata.membershipBrand / membershipId.
   */
  membership: taskMembershipSchema.nullable().optional(),
  /** Nest confirmationSchema from task detail — drives dynamic form fields. */
  confirmationSchema: taskConfirmationFormSchema.nullable().optional(),
  /** Nest confirmationPrefill — initial values keyed by schema field key. */
  confirmationPrefill: z.record(z.string(), z.string()).optional(),
  canReject: z.boolean().optional(),
  rejectUntil: z.string().nullable().optional(),
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
