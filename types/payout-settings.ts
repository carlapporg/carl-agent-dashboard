import { z } from "zod";

export const payoutOnboardingStatusSchema = z.enum([
  "not_started",
  "pending",
  "complete",
  "restricted",
]);

export const payoutAccountTypeSchema = z.enum(["checking", "savings"]);

export const preferredPayoutMethodSchema = z.enum([
  "stripe_connect",
  "manual_bank",
]);

export const payoutSettingsSchema = z
  .object({
    onboardingStatus: payoutOnboardingStatusSchema,
    payoutsEnabled: z.boolean(),
    detailsSubmitted: z.boolean(),
    chargesEnabled: z.boolean().optional(),
    hasConnectAccount: z.boolean(),
    bankLast4: z.string().nullable().optional(),
    bankName: z.string().nullable().optional(),
    hasManualBank: z.boolean(),
    manualBankLast4: z.string().nullable().optional(),
    manualBankName: z.string().nullable().optional(),
    manualBankHolderName: z.string().nullable().optional(),
    manualBankRoutingLast4: z.string().nullable().optional(),
    manualBankAccountType: payoutAccountTypeSchema.nullable().optional(),
    preferredPayoutMethod: preferredPayoutMethodSchema.nullable().optional(),
    currency: z.string().optional(),
    stripeConfigured: z.boolean(),
  })
  .passthrough();

export const payoutConnectLinkSchema = z
  .object({
    url: z.string().url(),
    onboardingStatus: payoutOnboardingStatusSchema,
  })
  .passthrough();

export const payoutLoginLinkSchema = z
  .object({
    url: z.string().url(),
  })
  .passthrough();

export type PayoutOnboardingStatus = z.infer<
  typeof payoutOnboardingStatusSchema
>;
export type PayoutAccountType = z.infer<typeof payoutAccountTypeSchema>;
export type PreferredPayoutMethod = z.infer<typeof preferredPayoutMethodSchema>;
export type PayoutSettings = z.infer<typeof payoutSettingsSchema>;
export type PayoutConnectLink = z.infer<typeof payoutConnectLinkSchema>;
export type PayoutLoginLink = z.infer<typeof payoutLoginLinkSchema>;

export type UpsertManualBankInput = {
  holderName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: PayoutAccountType;
  bankName?: string;
  preferredPayoutMethod?: PreferredPayoutMethod;
};
