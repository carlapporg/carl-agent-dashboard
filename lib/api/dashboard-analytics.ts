import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardRange } from "@/lib/dashboard/range";

export type DashboardOverview = {
  range: DashboardRange | string;
  from: string;
  to: string;
  timeZone: string;
  needsAttention: number;
  inProgress: number;
  waitingOnCustomer: number;
  completed: number;
  waiting: number;
  total: number;
  completedDeltaPercent: number | null;
};

export type TasksPerHourBucket = {
  key: string;
  label: string;
  taskCount: number;
  /** Present when API sends status split fields. */
  hasStatusSplit: boolean;
  completed: number;
  inProgress: number;
  durationHours: number;
  durationLabel: string;
};

export type TasksPerHour = {
  range: DashboardRange | string;
  points: number[];
  deltaPercent: number | null;
  hoursToday: number;
  label?: string;
  timeZone?: string;
  buckets: TasksPerHourBucket[];
};

const overviewSchema = z.object({
  range: z.string(),
  from: z.string(),
  to: z.string(),
  timeZone: z.string().optional(),
  needsAttention: z.number(),
  inProgress: z.number(),
  waitingOnCustomer: z.number(),
  completed: z.number(),
  waiting: z.number().optional(),
  total: z.number(),
  completedDeltaPercent: z.number().nullable().optional(),
});

const bucketSchema = z.object({
  key: z.string(),
  label: z.string(),
  taskCount: z.number(),
  completed: z.number().optional(),
  inProgress: z.number().optional(),
  durationHours: z.number().optional(),
  durationLabel: z.string().optional(),
});

const tasksPerHourSchema = z.object({
  range: z.string().optional(),
  points: z.array(z.number()),
  deltaPercent: z.number().nullable().optional(),
  hoursToday: z.number().optional(),
  label: z.string().optional(),
  timeZone: z.string().optional(),
  buckets: z.array(bucketSchema).optional(),
});

function unwrap(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const record = data as Record<string, unknown>;
  return record.data ?? data;
}

function normalizePoints(points: number[]): number[] {
  return points.map((n) => (Number.isFinite(n) ? n : 0));
}

function parseOverview(data: unknown): DashboardOverview | null {
  const parsed = overviewSchema.safeParse(unwrap(data));
  if (!parsed.success) return null;
  const row = parsed.data;
  return {
    range: row.range,
    from: row.from,
    to: row.to,
    timeZone: row.timeZone ?? "UTC",
    needsAttention: row.needsAttention,
    inProgress: row.inProgress,
    waitingOnCustomer: row.waitingOnCustomer,
    completed: row.completed,
    waiting: row.waiting ?? row.waitingOnCustomer,
    total: row.total,
    completedDeltaPercent: row.completedDeltaPercent ?? null,
  };
}

function parseTasksPerHour(data: unknown): TasksPerHour | null {
  const parsed = tasksPerHourSchema.safeParse(unwrap(data));
  if (!parsed.success) return null;
  const row = parsed.data;
  const points = normalizePoints(row.points);
  const buckets =
    row.buckets?.map((b) => {
      const hasStatusSplit =
        typeof b.completed === "number" || typeof b.inProgress === "number";
      return {
        key: b.key,
        label: b.label,
        taskCount: b.taskCount,
        hasStatusSplit,
        completed: hasStatusSplit ? (b.completed ?? 0) : 0,
        inProgress: hasStatusSplit ? (b.inProgress ?? 0) : 0,
        durationHours: b.durationHours ?? 0,
        durationLabel: b.durationLabel ?? "00:00:00 Hours",
      };
    }) ?? [];
  return {
    range: row.range ?? "today",
    points,
    deltaPercent: row.deltaPercent ?? null,
    hoursToday: row.hoursToday ?? 0,
    label: row.label,
    timeZone: row.timeZone,
    buckets,
  };
}

function withRange(path: string, range?: DashboardRange): string {
  if (!range) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}range=${encodeURIComponent(range)}`;
}

export const dashboardAnalyticsApi = {
  async getOverview(range: DashboardRange = "this_month"): Promise<DashboardOverview> {
    const data = await apiRequest(
      withRange(API_ENDPOINTS.agents.dashboardOverview, range),
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      },
    );
    const parsed = parseOverview(data);
    if (!parsed) {
      throw new Error("Unable to load dashboard overview.");
    }
    return parsed;
  },

  /** Hourly/daily series. Default range `today` keeps 24-point backward compat. */
  async getTasksPerHour(range: DashboardRange = "today"): Promise<TasksPerHour> {
    const data = await apiRequest(
      withRange(API_ENDPOINTS.agents.tasksPerHour, range),
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      },
    );
    const parsed = parseTasksPerHour(data);
    if (!parsed) {
      throw new Error("Unable to load tasks per hour.");
    }
    return parsed;
  },
};
