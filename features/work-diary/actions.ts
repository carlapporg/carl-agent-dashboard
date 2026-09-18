"use server";

import { timesheetApi } from "@/lib/api/timesheet";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import type { Timesheet, TimesheetQuery } from "@/types/timesheet";

export type TimesheetActionResult =
  | { ok: true; data: Timesheet }
  | { ok: false; message: string };

function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.floor((b - a) / 86_400_000) + 1;
}

export async function getTimesheetAction(
  query: TimesheetQuery,
): Promise<TimesheetActionResult> {
  if ("from" in query) {
    if (query.from > query.to) {
      return { ok: false, message: "Start date must be on or before end date." };
    }
    const span = daysInclusive(query.from, query.to);
    if (span > 31) {
      return {
        ok: false,
        message: "Date range can be at most 31 days.",
      };
    }
  }

  try {
    return { ok: true, data: await timesheetApi.get(query) };
  } catch (error) {
    if (isApiError(error)) {
      return { ok: false, message: toUserMessage(error) };
    }
    return { ok: false, message: toUserMessage(error) };
  }
}
