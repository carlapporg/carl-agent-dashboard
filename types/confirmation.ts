import { z } from "zod";

export const taskConfirmationStatusSchema = z.enum([
  "DRAFT",
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

/** One field in Nest's confirmationSchema.fields[] */
export const confirmationSchemaFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional().default(false),
  prefillFrom: z.array(z.string()).optional(),
});

export type ConfirmationSchemaField = z.infer<
  typeof confirmationSchemaFieldSchema
>;

/** Task-type confirmation form definition from Nest */
export const confirmationFormSchemaSchema = z.object({
  taskType: z.string().optional(),
  costRequired: z.boolean().optional().default(true),
  fields: z.array(confirmationSchemaFieldSchema).default([]),
});

export type ConfirmationFormSchema = z.infer<
  typeof confirmationFormSchemaSchema
>;

export const taskConfirmationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    taskId: z.union([z.string(), z.number()]).transform(String),
    agentId: z.union([z.string(), z.number()]).transform(String).optional(),
    /** Client user id — do not show this as PII in UI. */
    userId: z.union([z.string(), z.number()]).transform(String).optional(),
    status: taskConfirmationStatusSchema,
    taskType: z.string().optional(),
    confirmationSchema: confirmationFormSchemaSchema.optional(),
    title: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    rows: z.array(taskConfirmationRowSchema).default([]),
    cost: z.union([z.string(), z.number()]).transform(String),
    currency: z.string().optional().default("USD"),
    costLabel: z.string().optional().default("Total"),
    costDisplay: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    createdAt: z.string().optional().default(""),
    updatedAt: z.string().optional().default(""),
    decidedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type TaskConfirmation = z.infer<typeof taskConfirmationSchema>;

/** Body for POST .../confirmation/draft (and legacy one-shot). */
export const draftTaskConfirmationBodySchema = z.object({
  notes: z.string().trim().max(5000).optional().default(""),
  cost: z.string().trim().min(1).max(40),
  currency: z.string().trim().max(10).optional(),
  /**
   * Optional until Nest accepts agent-authored rows.
   * When supported, these should become the confirmation preview (not AI dump).
   */
  rows: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .optional(),
});

export type DraftTaskConfirmationBody = z.infer<
  typeof draftTaskConfirmationBodySchema
>;

/** @deprecated Prefer draft + send. Same body shape as draft. */
export const sendTaskConfirmationBodySchema = draftTaskConfirmationBodySchema;
export type SendTaskConfirmationBody = DraftTaskConfirmationBody;

const CONFIRM_SEND_STATUSES = new Set([
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

/**
 * GET confirmation only when Nest status implies one was already created.
 * Do **not** probe on fresh IN_PROGRESS — Nest returns 404 when none exists.
 * After a decline Nest returns to IN_PROGRESS; the workspace hydrates via
 * session presence + socket instead of a blind GET.
 * DRAFT confirmations are hydrated the same way after create.
 */
export function shouldFetchTaskConfirmation(status?: string | null): boolean {
  return (
    status === "WAITING_FOR_USER" ||
    status === "WAITING_FOR_AGENT" ||
    status === "COMPLETED"
  );
}

export function isConfirmationDraft(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "DRAFT";
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
    case "DRAFT":
      return "Draft preview";
    case "PENDING":
      return "Waiting for Customer";
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

export function parseConfirmationFormSchema(
  value: unknown,
): ConfirmationFormSchema | null {
  const parsed = confirmationFormSchemaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseConfirmationPrefill(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw == null) continue;
    if (typeof raw === "object") continue;
    const text = String(raw).trim();
    if (text) out[key] = text;
  }
  return out;
}

/**
 * Build draft `notes` from field values so Nest can merge agent edits.
 * Uses field labels from the form (schema labels when available).
 */
export function buildConfirmationDraftNotes(
  fields: ConfirmationSchemaField[],
  values: Record<string, string>,
): string {
  const lines: string[] = [];
  let freeNotes = "";

  for (const field of fields) {
    const value = (values[field.key] ?? "").trim();
    if (!value) continue;
    if (field.key === "notes" || field.key === "details") {
      freeNotes = value;
      continue;
    }
    lines.push(`${field.label}: ${value}`);
  }

  if (freeNotes) lines.push(freeNotes);
  return lines.join("\n").trim();
}

/** Agent-authored confirmation rows for draft body when Nest accepts `rows`. */
export function buildConfirmationDraftRows(
  fields: ConfirmationSchemaField[],
  values: Record<string, string>,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const field of fields) {
    if (field.key === "notes" || field.key === "details") continue;
    const value = (values[field.key] ?? "").trim();
    if (!value) continue;
    rows.push({ label: field.label, value });
  }
  return rows;
}
