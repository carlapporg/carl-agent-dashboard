"use server";

import { calendarApi } from "@/lib/api/calendar";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import type {
  CalendarAvailability,
  CalendarAvailabilityQuery,
  CalendarDay,
  CalendarMonth,
  CalendarMonthQuery,
  CalendarUpcoming,
  CalendarUpcomingQuery,
  CalendarWeek,
} from "@/types/calendar";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.floor((b - a) / 86_400_000) + 1;
}

function fail(error: unknown): ActionResult<never> {
  if (isApiError(error)) {
    console.error("[calendar]", {
      status: error.status,
      code: error.code,
      kind: error.kind,
      message: error.message,
    });
    return { ok: false, message: toUserMessage(error) };
  }
  console.error("[calendar] unexpected", error);
  return { ok: false, message: toUserMessage(error) };
}

export async function getCalendarMonthAction(
  query: CalendarMonthQuery,
): Promise<ActionResult<CalendarMonth>> {
  if (
    !Number.isInteger(query.year) ||
    !Number.isInteger(query.month) ||
    query.month < 1 ||
    query.month > 12
  ) {
    return { ok: false, message: "Month must be 1–12." };
  }
  try {
    return { ok: true, data: await calendarApi.getMonth(query) };
  } catch (error) {
    return fail(error);
  }
}

export async function getCalendarWeekAction(
  date: string,
): Promise<ActionResult<CalendarWeek>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Date must be YYYY-MM-DD." };
  }
  try {
    return { ok: true, data: await calendarApi.getWeek(date) };
  } catch (error) {
    return fail(error);
  }
}

export async function getCalendarDayAction(
  date: string,
): Promise<ActionResult<CalendarDay>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Date must be YYYY-MM-DD." };
  }
  try {
    return { ok: true, data: await calendarApi.getDay(date) };
  } catch (error) {
    return fail(error);
  }
}

export async function getCalendarUpcomingAction(
  query: CalendarUpcomingQuery = {},
): Promise<ActionResult<CalendarUpcoming>> {
  try {
    return { ok: true, data: await calendarApi.getUpcoming(query) };
  } catch (error) {
    return fail(error);
  }
}

export async function getCalendarAvailabilityAction(
  query: CalendarAvailabilityQuery,
): Promise<ActionResult<CalendarAvailability>> {
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
    return { ok: true, data: await calendarApi.getAvailability(query) };
  } catch (error) {
    return fail(error);
  }
}
