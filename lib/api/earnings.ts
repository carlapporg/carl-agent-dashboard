import { z } from "zod";
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

  async getPayOptions(day?: string): Promise<PayOptions> {
    const query = day ? `?day=${encodeURIComponent(day)}` : "";
    return apiRequest(`${API_ENDPOINTS.agents.earningsPayOptions}${query}`, {
      method: "GET",
      schema: payOptionsSchema,
      looseEnvelope: true,
    });
  },

  async requestPay(mode: PayMode, day?: string): Promise<PayRecord> {
    const body =
      mode === "daily" && day ? { mode, day } : { mode };
    return apiRequest(API_ENDPOINTS.agents.earningsPayRequests, {
      method: "POST",
      body,
      schema: payRecordSchema,
      looseEnvelope: true,
    });
  },

  async getPay(payId: string): Promise<PayRecord> {
    return apiRequest(API_ENDPOINTS.agents.earningsPay(payId), {
      method: "GET",
      schema: payRecordSchema,
      looseEnvelope: true,
    });
  },
};

const cents = z.coerce.number();
const hours = z.coerce.number();

const timesheetSchema = z
  .array(
    z.object({
      status: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable().optional(),
    }),
  )
  .optional()
  .default([]);

const payRecordSchema = z.object({
  id: z.string(),
  mode: z.string(),
  status: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  hoursWorked: hours,
  availableHours: hours.optional().default(0),
  busyHours: hours.optional().default(0),
  hourlyRateCents: z.number().nullable().optional(),
  amountCents: cents,
  currency: z.string().optional().default("USD"),
  method: z.string().nullable().optional(),
  proofUrl: z.string().nullable().optional(),
  timesheet: timesheetSchema,
  paidAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
});

const payChoiceSchema = z.object({
  mode: z.enum(["weekly", "biweekly", "monthly", "daily"]),
  enabled: z.boolean(),
  reason: z.string().nullable().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  unpaidRanges: z
    .array(
      z.object({
        periodStart: z.string(),
        periodEnd: z.string(),
      }),
    )
    .nullable()
    .optional(),
  quote: z
    .object({
      hoursWorked: hours,
      amountCents: cents,
      hourlyRateCents: z.number().nullable().optional(),
      tipCents: cents.optional(),
      bonusCents: cents.optional(),
    })
    .nullable()
    .optional(),
});

const payOptionsSchema = z.object({
  choices: z.array(payChoiceSchema).default([]),
  openRequest: payRecordSchema.nullable().optional().default(null),
});

export type PayMode = "weekly" | "biweekly" | "monthly" | "daily";
export type PayRecord = z.infer<typeof payRecordSchema>;
export type PayOptions = z.infer<typeof payOptionsSchema>;
