import { z } from "zod";

export const taskPaymentStatusSchema = z.enum([
  "requires_payment",
  "captured",
  "card_issued",
  "spent",
  "cancelled",
  "failed",
  "expired",
]);

export type TaskPaymentStatus = z.infer<typeof taskPaymentStatusSchema>;

export const taskPaymentSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  confirmationId: z.string().nullable().optional(),
  userId: z.string().optional(),
  requestedByAgentId: z.string().optional(),
  spendAmountCents: z.number(),
  chargeAmountCents: z.number(),
  feeEstimateCents: z.number().optional().default(0),
  spendDisplay: z.string(),
  chargeDisplay: z.string(),
  currency: z.string().default("usd"),
  status: taskPaymentStatusSchema,
  last4: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  hasCard: z.boolean().optional().default(false),
  paidAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskPayment = z.infer<typeof taskPaymentSchema>;

export const virtualCardSecretsSchema = z.object({
  paymentId: z.string(),
  taskId: z.string(),
  spendAmountCents: z.number(),
  currency: z.string().default("usd"),
  number: z.string().nullable().optional(),
  cvc: z.string().nullable().optional(),
  expMonth: z.number().nullable().optional(),
  expYear: z.number().nullable().optional(),
  last4: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  status: z.string().optional().default(""),
});

export type VirtualCardSecrets = z.infer<typeof virtualCardSecretsSchema>;

export const requestTaskPaymentResultSchema = z.object({
  payment: taskPaymentSchema,
  stripe: z.unknown().optional(),
});

export const cancelTaskPaymentResultSchema = z.object({
  payment: taskPaymentSchema,
});

export function dollarsToSpendCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0.01) return null;
  return Math.round(value * 100);
}

export function formatPan(number: string | null | undefined): string {
  if (!number) return "—";
  const digits = number.replace(/\D/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatCardExp(
  month: number | null | undefined,
  year: number | null | undefined,
): string {
  if (month == null || year == null) return "—";
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

export function taskPaymentStatusLabel(status: TaskPaymentStatus): string {
  switch (status) {
    case "requires_payment":
      return "Waiting for payment";
    case "captured":
      return "Payment received";
    case "card_issued":
      return "Card ready";
    case "spent":
      return "Card used";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

export function canCancelTaskPayment(status: TaskPaymentStatus): boolean {
  return (
    status === "requires_payment" ||
    status === "captured" ||
    status === "card_issued"
  );
}

export function canRevealTaskCard(status: TaskPaymentStatus): boolean {
  return status === "card_issued" || status === "spent";
}

export function parseTaskPaymentPayload(payload: unknown): {
  paymentId?: string;
  taskId?: string;
  last4?: string | null;
  brand?: string | null;
  spendAmountCents?: number;
  currency?: string;
  status?: TaskPaymentStatus;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root.payment && typeof root.payment === "object"
        ? (root.payment as Record<string, unknown>)
        : root;
  const paymentId =
    typeof data.paymentId === "string"
      ? data.paymentId
      : typeof data.id === "string"
        ? data.id
        : undefined;
  const taskId =
    typeof data.taskId === "string"
      ? data.taskId
      : typeof root.taskId === "string"
        ? root.taskId
        : undefined;
  if (!paymentId && !taskId) return null;
  const statusRaw = data.status;
  const status =
    typeof statusRaw === "string" &&
    taskPaymentStatusSchema.safeParse(statusRaw).success
      ? (statusRaw as TaskPaymentStatus)
      : undefined;
  return {
    paymentId,
    taskId,
    last4: typeof data.last4 === "string" ? data.last4 : null,
    brand: typeof data.brand === "string" ? data.brand : null,
    spendAmountCents:
      typeof data.spendAmountCents === "number"
        ? data.spendAmountCents
        : undefined,
    currency: typeof data.currency === "string" ? data.currency : undefined,
    status,
  };
}
