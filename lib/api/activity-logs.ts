import { z } from "zod";
import {
  parseActivityItem,
  unwrapActivityList,
  type ActivityLogFilter,
  type ActivityLogItem,
} from "@/lib/activity/parse-api";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { Task } from "@/types/task";

export type {
  ActivityLogFilter,
  ActivityLogItem,
  ActivityLogKind,
} from "@/lib/activity/parse-api";

function fromHistoryTasks(tasks: Task[]): ActivityLogItem[] {
  return tasks.map((task) => ({
    id: `hist_${task.id}`,
    kind: "task_status" as const,
    title: task.status === "completed" ? "Task Completed" : "Task Closed",
    body: `${task.title} for ${task.customerName} marked ${task.status.replaceAll("_", " ")}`,
    taskLabel: task.code
      ? task.code.startsWith("#")
        ? task.code
        : `#${task.code}`
      : `#T-${task.number}`,
    actor: "Agent",
    at: task.completedAt ?? task.updatedAt,
    taskId: task.id,
  }));
}

function withKindQuery(kind: ActivityLogFilter, limit: number): string {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("limit", String(limit));
  return `${API_ENDPOINTS.agents.activityLogs}?${params.toString()}`;
}

/** Server-only. Client code should import types/parsers from `@/lib/activity/parse-api`. */
export const activityLogsApi = {
  async list(
    options: {
      kind?: ActivityLogFilter;
      limit?: number;
      historyTasks?: Task[];
    } = {},
  ): Promise<ActivityLogItem[]> {
    const kind = options.kind ?? "all";
    const limit = options.limit ?? 50;
    const historyTasks = options.historyTasks ?? [];

    try {
      const data = await apiRequest(withKindQuery(kind, limit), {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      });
      const rows = unwrapActivityList(data)
        .map(parseActivityItem)
        .filter((row): row is ActivityLogItem => Boolean(row))
        .sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        );
      if (rows.length > 0 || kind !== "all") return rows;
      return fromHistoryTasks(historyTasks).sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
    } catch {
      if (kind === "handover" || kind === "system") return [];
      return fromHistoryTasks(historyTasks).sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
    }
  },
};
