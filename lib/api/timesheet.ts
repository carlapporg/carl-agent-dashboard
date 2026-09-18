import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import {
  timesheetSchema,
  type Timesheet,
  type TimesheetQuery,
} from "@/types/timesheet";

function buildPath(query: TimesheetQuery): string {
  const base = API_ENDPOINTS.agents.timesheet;
  if ("date" in query) {
    return `${base}?date=${encodeURIComponent(query.date)}`;
  }
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
  });
  return `${base}?${params.toString()}`;
}

function emptyTimesheet(query: TimesheetQuery): Timesheet {
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

export const timesheetApi = {
  async get(query: TimesheetQuery): Promise<Timesheet> {
    if (!env.isApiConfigured) {
      return emptyTimesheet(query);
    }

    const data = await apiRequest(buildPath(query), {
      method: "GET",
      schema: timesheetSchema,
      looseEnvelope: true,
    });
    return data;
  },
};
