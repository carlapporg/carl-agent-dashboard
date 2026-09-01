import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export type TasksPerHour = {
  points: number[];
  deltaPercent: number | null;
  label?: string;
};

const tasksPerHourSchema = z.object({
  points: z.array(z.number()),
  deltaPercent: z.number().nullable().optional(),
  label: z.string().optional(),
});

function normalizePoints(points: number[]): number[] {
  if (points.length === 24) return points;
  if (points.length > 24) return points.slice(0, 24);
  return [...points, ...Array.from({ length: 24 - points.length }, () => 0)];
}

function parseTasksPerHour(data: unknown): TasksPerHour | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidate = record.data ?? data;
  const parsed = tasksPerHourSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    points: normalizePoints(parsed.data.points),
    deltaPercent: parsed.data.deltaPercent ?? null,
    label: parsed.data.label,
  };
}

export const dashboardAnalyticsApi = {
  /** Hourly completed tasks for today (UTC buckets). */
  async getTasksPerHour(): Promise<TasksPerHour> {
    const data = await apiRequest(API_ENDPOINTS.agents.tasksPerHour, {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    const parsed = parseTasksPerHour(data);
    if (!parsed) {
      throw new Error("Unable to load tasks per hour.");
    }
    return parsed;
  },
};
