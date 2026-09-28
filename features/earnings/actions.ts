"use server";

import { earningsApi } from "@/lib/api/earnings";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import type {
  EarningsLedgerList,
  EarningsRange,
  EarningsSummary,
  EarningsTips,
  HourlyRate,
} from "@/types/earnings";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): ActionResult<never> {
  if (isApiError(error)) {
    return { ok: false, message: toUserMessage(error) };
  }
  return { ok: false, message: toUserMessage(error) };
}

function checkRange(range: EarningsRange): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
    return "Dates must be YYYY-MM-DD.";
  }
  if (range.from > range.to) {
    return "Start date must be on or before end date.";
  }
  return null;
}

export async function getEarningsSummaryAction(
  range: EarningsRange,
): Promise<ActionResult<EarningsSummary>> {
  const message = checkRange(range);
  if (message) return { ok: false, message };
  try {
    return { ok: true, data: await earningsApi.getSummary(range) };
  } catch (error) {
    return fail(error);
  }
}

export async function getEarningsTipsAction(
  range: EarningsRange,
): Promise<ActionResult<EarningsTips>> {
  const message = checkRange(range);
  if (message) return { ok: false, message };
  try {
    return { ok: true, data: await earningsApi.getTips(range) };
  } catch (error) {
    return fail(error);
  }
}

export async function getEarningsLedgerAction(
  range: EarningsRange,
): Promise<ActionResult<EarningsLedgerList>> {
  const message = checkRange(range);
  if (message) return { ok: false, message };
  try {
    return { ok: true, data: await earningsApi.getLedger(range) };
  } catch (error) {
    return fail(error);
  }
}

export async function getHourlyRateAction(): Promise<ActionResult<HourlyRate>> {
  try {
    return { ok: true, data: await earningsApi.getHourlyRate() };
  } catch (error) {
    return fail(error);
  }
}

export async function getPayOptionsAction(day?: string) {
  try {
    return { ok: true as const, data: await earningsApi.getPayOptions(day) };
  } catch (error) {
    return fail(error);
  }
}

export async function requestPayAction(
  mode: "weekly" | "biweekly" | "monthly" | "daily",
  day?: string,
) {
  try {
    return { ok: true as const, data: await earningsApi.requestPay(mode, day) };
  } catch (error) {
    return fail(error);
  }
}

export async function getPayAction(payId: string) {
  try {
    return { ok: true as const, data: await earningsApi.getPay(payId) };
  } catch (error) {
    return fail(error);
  }
}
