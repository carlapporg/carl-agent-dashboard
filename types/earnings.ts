import { z } from "zod";

const money = z.coerce.number();
const idString = z.union([z.string(), z.number()]).transform(String);

export const earningsLedgerKindSchema = z.enum([
  "wage",
  "tip",
  "bonus",
  "adjustment",
  "reimbursement",
  "penalty",
]);

export const earningsLedgerStatusSchema = z.enum([
  "earned",
  "approved",
  "paid",
  "void",
]);

export const earningsLedgerEntrySchema = z
  .object({
    id: idString,
    kind: earningsLedgerKindSchema,
    status: earningsLedgerStatusSchema,
    amount: money,
    amountCents: z.coerce.number().optional(),
    hoursWorked: z.coerce.number().nullable().optional(),
    hourlyRate: money.nullable().optional(),
    hourlyRateCents: z.coerce.number().nullable().optional(),
    description: z.string().nullable().optional(),
    periodStart: z.string().nullable().optional(),
    periodEnd: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    tipId: z.string().nullable().optional(),
    batchId: z.string().nullable().optional(),
  })
  .passthrough();

export const earningsPreviewSchema = z
  .object({
    hoursWorked: money,
    hourlyRateCents: z.coerce.number(),
    wagesCents: z.coerce.number(),
  })
  .passthrough();

export const earningsSummarySchema = z
  .object({
    hoursWorked: money,
    hourlyRate: money,
    hourlyRateCents: z.coerce.number(),
    source: z.enum(["ledger", "ledger_plus_preview"]),
    earned: z
      .object({
        wages: money,
        tips: money,
        bonuses: money,
        adjustments: money,
        reimbursements: money,
        penalties: money,
      })
      .passthrough(),
    gross: money,
    grossCents: z.coerce.number().optional(),
    payroll: z
      .object({
        approved: money,
        paid: money,
        pending: money,
      })
      .passthrough(),
    preview: earningsPreviewSchema.nullable(),
    entries: z.array(earningsLedgerEntrySchema).default([]),
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
  })
  .passthrough();

export const earningsTipSchema = z
  .object({
    id: idString,
    taskId: idString,
    amount: money,
    amountCents: z.coerce.number().optional(),
    status: z.string(),
    note: z.string().nullable().optional(),
    paidOutAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();

export const earningsTipsSchema = z
  .object({
    tips: z.array(earningsTipSchema).default([]),
    totalCents: z.coerce.number(),
  })
  .passthrough();

export const hourlyRateRowSchema = z
  .object({
    hourlyRate: money.optional(),
    hourlyRateCents: z.coerce.number(),
    source: z.string().optional(),
    effectiveFrom: z.string().nullable().optional(),
    effectiveTo: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    currency: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const hourlyRateSchema = z
  .object({
    current: hourlyRateRowSchema,
    history: z.array(hourlyRateRowSchema).default([]),
  })
  .passthrough();

export const earningsLedgerListSchema = z
  .object({
    entries: z.array(earningsLedgerEntrySchema).default([]),
  })
  .passthrough();

export type EarningsSummary = z.infer<typeof earningsSummarySchema>;
export type EarningsLedgerEntry = z.infer<typeof earningsLedgerEntrySchema>;
export type EarningsTips = z.infer<typeof earningsTipsSchema>;
export type EarningsTip = z.infer<typeof earningsTipSchema>;
export type HourlyRate = z.infer<typeof hourlyRateSchema>;
export type HourlyRateRow = z.infer<typeof hourlyRateRowSchema>;
export type EarningsLedgerList = z.infer<typeof earningsLedgerListSchema>;

export type EarningsRange = { from: string; to: string };
