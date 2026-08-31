import { z } from "zod";

export const taskConfirmationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "DECLINED",
  "SUPERSEDED",
]);

export type TaskConfirmationStatus = z.infer<typeof taskConfirmationStatusSchema>;

export const taskConfirmationRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type TaskConfirmationRow = z.infer<typeof taskConfirmationRowSchema>;

export const taskConfirmationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    taskId: z.union([z.string(), z.number()]).transform(String),
    agentId: z.union([z.string(), z.number()]).transform(String).optional(),
    /** Client user id — do not show this as PII in UI. */
    userId: z.union([z.string(), z.number()]).transform(String).optional(),
    status: taskConfirmationStatusSchema,
    title: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    rows: z.array(taskConfirmationRowSchema).default([]),
    cost: z.union([z.string(), z.number()]).transform(String),
    currency: z.string().optional().default("PKR"),
    costLabel: z.string().optional().default("Total"),
    costDisplay: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    createdAt: z.string().optional().default(""),
    updatedAt: z.string().optional().default(""),
    decidedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type TaskConfirmation = z.infer<typeof taskConfirmationSchema>;

export const sendTaskConfirmationBodySchema = z.object({
  notes: z.string().trim().min(1).max(5000),
  cost: z.string().trim().min(1).max(40),
  currency: z.string().trim().max(10).optional(),
});

export type SendTaskConfirmationBody = z.infer<
  typeof sendTaskConfirmationBodySchema
>;

const CONFIRM_SEND_STATUSES = new Set([
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_AGENT",
]);

export function canSendTaskConfirmation(status?: string | null): boolean {
  if (!status) return false;
  if (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "OFFERED" ||
    status === "QUEUED"
  ) {
    return false;
  }
  return CONFIRM_SEND_STATUSES.has(status);
}

/** GET confirmation only after work has started (or the task is done). */
export function shouldFetchTaskConfirmation(status?: string | null): boolean {
  return (
    status === "IN_PROGRESS" ||
    status === "WAITING_FOR_USER" ||
    status === "WAITING_FOR_AGENT" ||
    status === "COMPLETED"
  );
}

export function isConfirmationPending(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "PENDING";
}

export function isConfirmationConfirmed(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "CONFIRMED";
}

export function confirmationStatusLabel(status: TaskConfirmationStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for client";
    case "CONFIRMED":
      return "Client approved";
    case "DECLINED":
      return "Client declined";
    case "SUPERSEDED":
      return "Replaced by a newer request";
  }
}

export function parseTaskConfirmationPayload(
  payload: unknown,
): TaskConfirmation | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  for (const candidate of [root.data, root.confirmation, payload]) {
    const parsed = taskConfirmationSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}
