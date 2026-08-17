import { z } from "zod";

export const spendingRulesSchema = z.object({
  autoApproveUnder: z.number(),
  monthlyLimit: z.number(),
  currency: z.string().default("USD"),
});

export const familyMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  spendingLimit: z.number().nullable().optional(),
});

export const paymentMethodSummarySchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string(),
  isDefault: z.boolean().default(false),
});

export const customerPreferenceSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const customerProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  preferences: z.array(customerPreferenceSchema).default([]),
  familyMembers: z.array(familyMemberSchema).default([]),
  paymentMethods: z.array(paymentMethodSummarySchema).default([]),
  spendingRules: spendingRulesSchema,
  memberSince: z.string(),
});

export const customerHistoryItemSchema = z.object({
  taskId: z.string(),
  taskNumber: z.number(),
  title: z.string(),
  status: z.string(),
  completedAt: z.string().nullable().optional(),
});

export type SpendingRules = z.infer<typeof spendingRulesSchema>;
export type FamilyMember = z.infer<typeof familyMemberSchema>;
export type PaymentMethodSummary = z.infer<typeof paymentMethodSummarySchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerHistoryItem = z.infer<typeof customerHistoryItemSchema>;
