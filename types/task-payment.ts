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

/** Nest payment routes use ParseUUIDPipe on `:paymentId`. */
const PAYMENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTaskPaymentUuid(value: unknown): value is string {
  return typeof value === "string" && PAYMENT_UUID_RE.test(value.trim());
}

/** Pull last4 from bodies like "Card •••• 0449 ready…". */
export function last4FromPaymentText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/••••\s*(\d{4})|·{4}\s*(\d{4})|\*{4}\s*(\d{4})/);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function looksLikeNotificationRecord(data: Record<string, unknown>): boolean {
  if (typeof data.kind === "string") return true;
  if (typeof data.title === "string" && typeof data.body === "string") {
    return true;
  }
  return false;
}

function looksLikePaymentRecord(data: Record<string, unknown>): boolean {
  if (typeof data.paymentId === "string") return true;
  if (typeof data.spendAmountCents === "number") return true;
  if (typeof data.chargeAmountCents === "number") return true;
  if (typeof data.spendDisplay === "string") return true;
  if (typeof data.status === "string") {
    return taskPaymentStatusSchema.safeParse(data.status).success;
  }
  return false;
}

function readPaymentIdCandidate(data: Record<string, unknown>): string | undefined {
  if (typeof data.paymentId === "string" && data.paymentId.trim()) {
    return data.paymentId.trim();
  }
  // Never treat notification `id` as payment id (dummy + live bug).
  if (looksLikeNotificationRecord(data)) return undefined;
  if (
    typeof data.id === "string" &&
    data.id.trim() &&
    data.taskId &&
    looksLikePaymentRecord(data)
  ) {
    return data.id.trim();
  }
  return undefined;
}

/** Forward-only payment status (never card_issued → captured). */
const PAYMENT_STATUS_RANK: Record<TaskPaymentStatus, number> = {
  requires_payment: 0,
  captured: 1,
  card_issued: 2,
  spent: 3,
  cancelled: 4,
  failed: 4,
  expired: 4,
};

export function mergePaymentStatus(
  current: TaskPaymentStatus | null | undefined,
  next: TaskPaymentStatus | null | undefined,
): TaskPaymentStatus {
  if (!next) return current ?? "requires_payment";
  if (!current) return next;
  // Terminal outcomes always win.
  if (
    next === "cancelled" ||
    next === "failed" ||
    next === "expired"
  ) {
    return next;
  }
  if (
    current === "cancelled" ||
    current === "failed" ||
    current === "expired"
  ) {
    return current;
  }
  return PAYMENT_STATUS_RANK[next] >= PAYMENT_STATUS_RANK[current]
    ? next
    : current;
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
  const candidates: Record<string, unknown>[] = [root];
  for (const key of ["data", "payment", "payload", "metadata"] as const) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      candidates.push(nested as Record<string, unknown>);
      const deeper = (nested as Record<string, unknown>).payment;
      if (deeper && typeof deeper === "object" && !Array.isArray(deeper)) {
        candidates.push(deeper as Record<string, unknown>);
      }
      const meta = (nested as Record<string, unknown>).metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        candidates.push(meta as Record<string, unknown>);
      }
    }
  }

  let paymentId: string | undefined;
  let taskId: string | undefined;
  let last4: string | null | undefined;
  let brand: string | null | undefined;
  let spendAmountCents: number | undefined;
  let currency: string | undefined;
  let status: TaskPaymentStatus | undefined;

  for (const data of candidates) {
    if (!paymentId) {
      const candidate = readPaymentIdCandidate(data);
      // Keep Stripe ic_… / junk out of reveal URLs.
      if (candidate && isTaskPaymentUuid(candidate)) {
        paymentId = candidate;
      }
    }
    if (!taskId && typeof data.taskId === "string") taskId = data.taskId;
    if (last4 == null && typeof data.last4 === "string") last4 = data.last4;
    if (brand == null && typeof data.brand === "string") brand = data.brand;
    if (
      spendAmountCents == null &&
      typeof data.spendAmountCents === "number"
    ) {
      spendAmountCents = data.spendAmountCents;
    }
    if (!currency && typeof data.currency === "string") currency = data.currency;
    if (!status && typeof data.status === "string") {
      const parsed = taskPaymentStatusSchema.safeParse(data.status);
      if (parsed.success) status = parsed.data;
    }
  }

  // Body like "Card •••• 4893 ready…"
  if (last4 == null) {
    const body =
      typeof root.body === "string"
        ? root.body
        : typeof root.title === "string"
          ? root.title
          : "";
    last4 = last4FromPaymentText(body);
  }

  if (!paymentId && !taskId) return null;
  return {
    paymentId,
    taskId,
    last4: last4 ?? null,
    brand: brand ?? null,
    spendAmountCents,
    currency,
    status,
  };
}
