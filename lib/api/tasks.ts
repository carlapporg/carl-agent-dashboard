import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { mapAgentTaskToUi } from "@/lib/api/map-task";
import {
  agentTaskListSchema,
  agentTaskSchema,
  type InboxFilter,
} from "@/types/agent";
import type { Task, TaskListFilters } from "@/types/task";

function applyClientFilters(tasks: Task[], filters: TaskListFilters = {}): Task[] {
  let list = [...tasks];

  if (filters.status && filters.status !== "all") {
    list = list.filter((t) => t.status === filters.status);
  }

  if (filters.waitingOn === "customer") {
    list = list.filter((t) => t.status === "waiting_for_customer");
  } else if (filters.waitingOn === "payment") {
    list = list.filter((t) => t.status === "waiting_for_payment");
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.request.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        (t.taskType?.toLowerCase().includes(q) ?? false) ||
        String(t.number).includes(q),
    );
  }

  return list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export const tasksApi = {
  async listByInbox(status?: InboxFilter): Promise<Task[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const rows = await apiRequest(`${API_ENDPOINTS.agents.tasks}${query}`, {
      method: "GET",
      schema: agentTaskListSchema,
    });
    return rows.map(mapAgentTaskToUi);
  },

  async list(filters: TaskListFilters = {}): Promise<Task[]> {
    const inbox: InboxFilter | undefined =
      filters.status === "completed" ||
      filters.status === "cancelled" ||
      filters.status === "failed"
        ? "HISTORY"
        : undefined;
    const tasks = await this.listByInbox(inbox);
    return applyClientFilters(tasks, filters);
  },

  async get(taskId: string): Promise<Task> {
    const row = await apiRequest(API_ENDPOINTS.agents.task(taskId), {
      method: "GET",
      schema: agentTaskSchema,
    });
    return mapAgentTaskToUi(row);
  },

  async reject(taskId: string, reason: string): Promise<{ message: string }> {
    return apiRequest(API_ENDPOINTS.agents.taskReject(taskId), {
      method: "POST",
      body: { reason },
      schema: z.object({ message: z.string() }),
      dedupe: false,
    });
  },

  async start(taskId: string): Promise<Task> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskStart(taskId), {
      method: "POST",
      schema: agentTaskSchema,
      dedupe: false,
    });
    return mapAgentTaskToUi(row);
  },

  async updateAgentStatus(
    taskId: string,
    status: "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER",
    note?: string,
  ): Promise<Task> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskStatus(taskId), {
      method: "PATCH",
      body: { status, note: note || undefined },
      schema: agentTaskSchema,
      dedupe: false,
    });
    return mapAgentTaskToUi(row);
  },
};

export const overviewStatsSchema = z.object({
  needsAttention: z.number(),
  inProgress: z.number(),
  waitingOnCustomer: z.number(),
});

export type OverviewStats = z.infer<typeof overviewStatsSchema>;

export async function getOverviewStats(): Promise<OverviewStats> {
  const [offered, active] = await Promise.all([
    tasksApi.listByInbox("OFFERED"),
    tasksApi.listByInbox("ACTIVE"),
  ]);
  return {
    needsAttention: offered.length,
    inProgress: active.filter((t) => t.backendStatus === "IN_PROGRESS").length,
    waitingOnCustomer: active.filter(
      (t) => t.backendStatus === "WAITING_FOR_USER",
    ).length,
  };
}
