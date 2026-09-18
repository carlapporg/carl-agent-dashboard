import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import {
  earningsLedgerListSchema,
  earningsSummarySchema,
  earningsTipsSchema,
  hourlyRateSchema,
  type EarningsLedgerList,
  type EarningsRange,
  type EarningsSummary,
  type EarningsTips,
  type HourlyRate,
} from "@/types/earnings";

function rangeQuery(range: EarningsRange): string {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  return params.toString();
}

function emptySummary(range: EarningsRange): EarningsSummary {
  return {
    from: range.from,
    to: range.to,
    hoursWorked: 0,
    hourlyRate: 0,
    hourlyRateCents: 0,
    source: "ledger",
    earned: {
      wages: 0,
      tips: 0,
      bonuses: 0,
      adjustments: 0,
      reimbursements: 0,
      penalties: 0,
    },
    gross: 0,
    payroll: { approved: 0, paid: 0, pending: 0 },
    preview: null,
    entries: [],
  };
}

export const earningsApi = {
  async getSummary(range: EarningsRange): Promise<EarningsSummary> {
    if (!env.isApiConfigured) return emptySummary(range);
    return apiRequest(
      `${API_ENDPOINTS.agents.earnings}?${rangeQuery(range)}`,
      {
        method: "GET",
        schema: earningsSummarySchema,
        looseEnvelope: true,
      },
    );
  },

  async getTips(range: EarningsRange): Promise<EarningsTips> {
    if (!env.isApiConfigured) return { tips: [], totalCents: 0 };
    return apiRequest(
      `${API_ENDPOINTS.agents.earningsTips}?${rangeQuery(range)}`,
      {
        method: "GET",
        schema: earningsTipsSchema,
        looseEnvelope: true,
      },
    );
  },

  async getHourlyRate(): Promise<HourlyRate> {
    if (!env.isApiConfigured) {
      return {
        current: {
          hourlyRateCents: 0,
          source: "system_default",
          effectiveFrom: null,
          effectiveTo: null,
        },
        history: [],
      };
    }
    return apiRequest(API_ENDPOINTS.agents.earningsHourlyRate, {
      method: "GET",
      schema: hourlyRateSchema,
      looseEnvelope: true,
    });
  },

  async getLedger(range: EarningsRange): Promise<EarningsLedgerList> {
    if (!env.isApiConfigured) return { entries: [] };
    return apiRequest(
      `${API_ENDPOINTS.agents.earningsLedger}?${rangeQuery(range)}`,
      {
        method: "GET",
        schema: earningsLedgerListSchema,
        looseEnvelope: true,
      },
    );
  },
};
