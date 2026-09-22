import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import {
  payoutConnectLinkSchema,
  payoutLoginLinkSchema,
  payoutSettingsSchema,
  type PayoutConnectLink,
  type PayoutLoginLink,
  type PayoutSettings,
  type UpsertManualBankInput,
} from "@/types/payout-settings";

function emptySettings(): PayoutSettings {
  return {
    onboardingStatus: "not_started",
    payoutsEnabled: false,
    detailsSubmitted: false,
    chargesEnabled: false,
    hasConnectAccount: false,
    bankLast4: null,
    bankName: null,
    hasManualBank: false,
    manualBankLast4: null,
    manualBankName: null,
    manualBankHolderName: null,
    manualBankRoutingLast4: null,
    manualBankAccountType: null,
    preferredPayoutMethod: null,
    currency: "usd",
    stripeConfigured: false,
  };
}

export const payoutSettingsApi = {
  async get(): Promise<PayoutSettings> {
    if (!env.isApiConfigured) return emptySettings();
    return apiRequest(API_ENDPOINTS.agents.payoutSettings, {
      method: "GET",
      schema: payoutSettingsSchema,
      looseEnvelope: true,
    });
  },

  async createConnectLink(country = "US"): Promise<PayoutConnectLink> {
    return apiRequest(API_ENDPOINTS.agents.payoutConnectLink, {
      method: "POST",
      body: { country },
      schema: payoutConnectLinkSchema,
      looseEnvelope: true,
    });
  },

  async createLoginLink(): Promise<PayoutLoginLink> {
    return apiRequest(API_ENDPOINTS.agents.payoutLoginLink, {
      method: "POST",
      schema: payoutLoginLinkSchema,
      looseEnvelope: true,
    });
  },

  async saveBank(input: UpsertManualBankInput): Promise<PayoutSettings> {
    const body: Record<string, string> = {
      holderName: input.holderName.trim(),
      routingNumber: input.routingNumber.replace(/\s+/g, ""),
      accountNumber: input.accountNumber.replace(/\s+/g, ""),
      accountType: input.accountType,
    };
    if (input.bankName?.trim()) body.bankName = input.bankName.trim();
    if (input.preferredPayoutMethod) {
      body.preferredPayoutMethod = input.preferredPayoutMethod;
    }
    return apiRequest(API_ENDPOINTS.agents.payoutBank, {
      method: "PUT",
      body,
      schema: payoutSettingsSchema,
      looseEnvelope: true,
    });
  },

  async clearBank(): Promise<PayoutSettings> {
    return apiRequest(API_ENDPOINTS.agents.payoutBankClear, {
      method: "POST",
      schema: payoutSettingsSchema,
      looseEnvelope: true,
    });
  },

  async disconnect(): Promise<PayoutSettings> {
    return apiRequest(API_ENDPOINTS.agents.payoutDisconnect, {
      method: "POST",
      schema: payoutSettingsSchema,
      looseEnvelope: true,
    });
  },
};
