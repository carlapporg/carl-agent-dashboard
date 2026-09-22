import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import {
  calendarAvailabilitySchema,
  calendarDaySchema,
  calendarMonthSchema,
  calendarUpcomingSchema,
  calendarWeekSchema,
  type CalendarAvailability,
  type CalendarAvailabilityQuery,
  type CalendarDay,
  type CalendarMonth,
  type CalendarMonthQuery,
  type CalendarUpcoming,
  type CalendarUpcomingQuery,
  type CalendarWeek,
} from "@/types/calendar";

const SHAPE_ERROR =
  "Timesheet data from the server didn't match the expected shape. Refresh and try again.";

function emptyAvailabilitySummary() {
  return {
    availableHours: 0,
    busyHours: 0,
    totalOnlineHours: 0,
    intervals: [],
  };
}

function emptyTimesheetLike(
  query: CalendarAvailabilityQuery,
): CalendarAvailability {
  if ("date" in query) {
    return {
      date: query.date,
      loginAt: null,
      logoutAt: null,
      totalOnlineHours: 0,
      availableHours: 0,
      busyHours: 0,
      intervals: [],
    };
  }
  return {
    from: query.from,
    to: query.to,
    loginAt: null,
    logoutAt: null,
    totalOnlineHours: 0,
    availableHours: 0,
    busyHours: 0,
    intervals: [],
  };
}

function buildAvailabilityPath(query: CalendarAvailabilityQuery): string {
  const base = API_ENDPOINTS.agents.calendarAvailability;
  if ("date" in query) {
    return `${base}?date=${encodeURIComponent(query.date)}`;
  }
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
  });
  return `${base}?${params.toString()}`;
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.error(`[calendar] ${label} shape mismatch`, parsed.error.issues.slice(0, 8));
  throw new ApiError(
    {
      code: "VALIDATION_ERROR",
      message: SHAPE_ERROR,
    },
    422,
    false,
    "unknown",
  );
}

async function fetchCalendarRaw(path: string): Promise<unknown> {
  return apiRequest(path, {
    method: "GET",
    schema: z.unknown(),
    looseEnvelope: true,
  });
}

export const calendarApi = {
  async getMonth(query: CalendarMonthQuery): Promise<CalendarMonth> {
    if (!env.isApiConfigured) {
      return {
        year: query.year,
        month: query.month,
        events: [],
        availability: emptyAvailabilitySummary(),
      };
    }
    const params = new URLSearchParams({
      year: String(query.year),
      month: String(query.month),
    });
    const raw = await fetchCalendarRaw(
      `${API_ENDPOINTS.agents.calendar}?${params.toString()}`,
    );
    return parseOrThrow(calendarMonthSchema, raw, "month");
  },

  async getWeek(date: string): Promise<CalendarWeek> {
    if (!env.isApiConfigured) {
      return { from: date, to: date, days: [] };
    }
    const raw = await fetchCalendarRaw(
      `${API_ENDPOINTS.agents.calendarWeek}?date=${encodeURIComponent(date)}`,
    );
    return parseOrThrow(calendarWeekSchema, raw, "week");
  },

  async getDay(date: string): Promise<CalendarDay> {
    if (!env.isApiConfigured) {
      return {
        date,
        events: [],
        timesheet: emptyTimesheetLike({ date }),
      };
    }
    const raw = await fetchCalendarRaw(
      `${API_ENDPOINTS.agents.calendarDay}?date=${encodeURIComponent(date)}`,
    );
    return parseOrThrow(calendarDaySchema, raw, "day");
  },

  async getUpcoming(
    query: CalendarUpcomingQuery = {},
  ): Promise<CalendarUpcoming> {
    if (!env.isApiConfigured) {
      return { items: [] };
    }
    const limit = query.limit ?? 20;
    const params = new URLSearchParams({ limit: String(limit) });
    const raw = await fetchCalendarRaw(
      `${API_ENDPOINTS.agents.calendarUpcoming}?${params.toString()}`,
    );
    return parseOrThrow(calendarUpcomingSchema, raw, "upcoming");
  },

  async getAvailability(
    query: CalendarAvailabilityQuery,
  ): Promise<CalendarAvailability> {
    if (!env.isApiConfigured) {
      return emptyTimesheetLike(query);
    }
    const raw = await fetchCalendarRaw(buildAvailabilityPath(query));
    return parseOrThrow(calendarAvailabilitySchema, raw, "availability");
  },
};
