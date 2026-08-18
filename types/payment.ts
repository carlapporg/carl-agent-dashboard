import { z } from "zod";

export const paymentAuthStatusSchema = z.enum([
  "pending",
  "approved",
  "declined",
  "expired",
  "spent",
]);

export const paymentAuthorizationSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  amount: z.number(),
  remaining: z.number(),
  currency: z.string().default("USD"),
  merchant: z.string(),
  merchantCategory: z.string().optional(),
  status: paymentAuthStatusSchema,
  approvedBy: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  requestedAt: z.string(),
});

export const virtualCardSummarySchema = z.object({
  id: z.string(),
  last4: z.string(),
  network: z.string().default("visa"),
  spendingLimit: z.number(),
  remaining: z.number(),
  merchantCategory: z.string().optional(),
  status: z.enum(["active", "locked", "cancelled"]),
  taskId: z.string(),
});

export const receiptSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  fileName: z.string(),
  amount: z.number().nullable().optional(),
  merchant: z.string().optional(),
  uploadedAt: z.string(),
  uploadedBy: z.string(),
});

export type PaymentAuthStatus = z.infer<typeof paymentAuthStatusSchema>;
export type PaymentAuthorization = z.infer<typeof paymentAuthorizationSchema>;
export type VirtualCardSummary = z.infer<typeof virtualCardSummarySchema>;
export type Receipt = z.infer<typeof receiptSchema>;
