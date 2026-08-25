import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import { mapAgentTaskToUi } from "@/lib/api/map-task";
import {
  agentTaskSchema,
  type AgentTask,
  type InboxFilter,
} from "@/types/agent";
import type { Task, TaskListFilters } from "@/types/task";

const mutationResultSchema = z.union([
  agentTaskSchema,
  z.object({ message: z.string() }),
]);

const INBOX_FALLBACK: Record<InboxFilter, readonly string[]> = {
  OFFERED: ["QUEUED"],
  ACTIVE: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_AGENT"],
  HISTORY: ["COMPLETED", "FAILED", "CANCELLED", "REJECTED"],
};

function isAgentTask(row: unknown): row is AgentTask {
  return agentTaskSchema.safeParse(row).success;
}

function isHistoryTask(task: Task): boolean {
  return (
    task.backendStatus === "COMPLETED" ||
    task.backendStatus === "FAILED" ||
    task.backendStatus === "CANCELLED" ||
    task.backendStatus === "REJECTED" ||
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  );
}

function extractTaskRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.tasks)) return record.tasks;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  if (record.task && typeof record.task === "object") return [record.task];
  if (record.id != null) return [record];
  return [];
}

function parseOneTask(row: unknown): Task | null {
  const nested =
    row &&
    typeof row === "object" &&
    "task" in row &&
    (row as { task: unknown }).task
      ? (row as { task: unknown }).task
      : row;
  const parsed = agentTaskSchema.safeParse(nested);
  return parsed.success ? mapAgentTaskToUi(parsed.data) : null;
}

function parseTaskRows(data: unknown): Task[] {
  const tasks: Task[] = [];
  for (const row of extractTaskRows(data)) {
    const task = parseOneTask(row);
    if (task) tasks.push(task);
  }
  return tasks;
}

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

function mergeById(groups: Task[][]): Task[] {
  const seen = new Set<string>();
  const merged: Task[] = [];
  for (const group of groups) {
    for (const task of group) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      merged.push(task);
    }
  }
  return merged;
}

type ListFetch = {
  ok: boolean;
  network: boolean;
  auth: boolean;
  tasks: Task[];
};

function isAuthListError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.status === 401 ||
    error.kind === "session" ||
    error.status === 403 ||
    error.kind === "forbidden"
  );
}

function emptyFetch(error: unknown): ListFetch {
  return {
    ok: false,
    network:
      isApiError(error) &&
      (error.kind === "network" || error.kind === "server" || error.status === 0),
    auth: isAuthListError(error),
    tasks: [],
  };
}

async function fetchTaskList(status: string): Promise<ListFetch> {
  try {
    const data = await apiRequest(
      `${API_ENDPOINTS.agents.tasks}?status=${encodeURIComponent(status)}`,
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      },
    );
    return { ok: true, network: false, auth: false, tasks: parseTaskRows(data) };
  } catch (error) {
    return emptyFetch(error);
  }
}

async function fetchMerged(queries: readonly string[]): Promise<ListFetch> {
  const parts = await Promise.all(queries.map((status) => fetchTaskList(status)));
  const anyOk = parts.some((part) => part.ok);
  const anyNetwork = parts.some((part) => part.network);
  const anyAuth = parts.some((part) => part.auth);
  return {
    ok: anyOk,
    network: !anyOk && anyNetwork,
    auth: !anyOk && anyAuth,
    tasks: mergeById(parts.map((part) => part.tasks)),
  };
}

function throwIfListUnreachable(fetch: ListFetch) {
  if (fetch.ok) return;
  if (fetch.auth || fetch.network) {
    throw new Error("Unable to reach the task list.");
  }
}

export const tasksApi = {
  async listByInbox(status: InboxFilter): Promise<Task[]> {
    if (status === "HISTORY") {
      const [primary, extra] = await Promise.all([
        fetchTaskList("HISTORY"),
        fetchMerged(INBOX_FALLBACK.HISTORY),
      ]);
      const tasks = mergeById([
        primary.ok ? primary.tasks : [],
        extra.tasks,
      ]).filter(isHistoryTask);
      if (primary.ok || extra.ok) return tasks;
      throwIfListUnreachable({
        ok: false,
        network: primary.network || extra.network,
        auth: primary.auth || extra.auth,
        tasks: [],
      });
      return [];
    }

    const primary = await fetchTaskList(status);
    if (primary.ok) return primary.tasks;
    const fallback = await fetchMerged(INBOX_FALLBACK[status]);
    if (fallback.ok) return fallback.tasks;
    throwIfListUnreachable({
      ok: false,
      network: primary.network || fallback.network,
      auth: primary.auth || fallback.auth,
      tasks: [],
    });
    return [];
  },

  async listOpen(): Promise<Task[]> {
    const [offered, active] = await Promise.all([
      fetchTaskList("OFFERED"),
      fetchTaskList("ACTIVE"),
    ]);
    let tasks = mergeById([offered.tasks, active.tasks]);
    let offeredOk = offered.ok;
    let activeOk = active.ok;
    let authFail = offered.auth || active.auth;
    let networkFail = offered.network || active.network;

    if (!offered.ok) {
      const fallback = await fetchMerged(INBOX_FALLBACK.OFFERED);
      tasks = mergeById([tasks, fallback.tasks]);
      offeredOk = offeredOk || fallback.ok;
      authFail = authFail || fallback.auth;
      networkFail = networkFail || fallback.network;
    }
    if (!active.ok) {
      const fallback = await fetchMerged(INBOX_FALLBACK.ACTIVE);
      tasks = mergeById([tasks, fallback.tasks]);
      activeOk = activeOk || fallback.ok;
      authFail = authFail || fallback.auth;
      networkFail = networkFail || fallback.network;
    }

    if (!offeredOk && !activeOk) {
      throwIfListUnreachable({
        ok: false,
        network: networkFail,
        auth: authFail,
        tasks: [],
      });
    }

    return tasks.filter((task) => !isHistoryTask(task));
  },

  async list(filters: TaskListFilters = {}): Promise<Task[]> {
    if (filters.waitingOn && filters.waitingOn !== "all") {
      return applyClientFilters(await this.listOpen(), filters);
    }

    const closedOnly =
      filters.status === "completed" ||
      filters.status === "cancelled" ||
      filters.status === "failed";

    if (closedOnly) {
      return applyClientFilters(await this.listByInbox("HISTORY"), filters);
    }

    const [open, history] = await Promise.all([
      this.listOpen(),
      this.listByInbox("HISTORY").catch(() => [] as Task[]),
    ]);
    return applyClientFilters(mergeById([open, history]), filters);
  },

  async get(taskId: string): Promise<Task> {
    const data = await apiRequest(API_ENDPOINTS.agents.task(taskId), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    const task = parseOneTask(data);
    if (!task) throw new Error("Unable to load this task.");
    return task;
  },

  async accept(taskId: string): Promise<Task | { message: string }> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskAccept(taskId), {
      method: "POST",
      schema: mutationResultSchema,
      dedupe: false,
    });
    return isAgentTask(row) ? mapAgentTaskToUi(row) : row;
  },

  async reject(taskId: string, reason: string): Promise<Task | { message: string }> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskReject(taskId), {
      method: "POST",
      body: { reason },
      schema: mutationResultSchema,
      dedupe: false,
    });
    return isAgentTask(row) ? mapAgentTaskToUi(row) : row;
  },

  async start(taskId: string): Promise<Task | null> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskStart(taskId), {
      method: "POST",
      schema: mutationResultSchema,
      dedupe: false,
    });
    return isAgentTask(row) ? mapAgentTaskToUi(row) : null;
  },

  async updateAgentStatus(
    taskId: string,
    status: "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER",
    note?: string,
  ): Promise<Task | null> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskStatus(taskId), {
      method: "PATCH",
      body: { status, note: note || undefined },
      schema: mutationResultSchema,
      looseEnvelope: true,
      dedupe: false,
    });
    return isAgentTask(row) ? mapAgentTaskToUi(row) : null;
  },
};

export const overviewStatsSchema = z.object({
  needsAttention: z.number(),
  inProgress: z.number(),
  waitingOnCustomer: z.number(),
});

export type OverviewStats = z.infer<typeof overviewStatsSchema>;

export async function getOverviewStats(): Promise<OverviewStats> {
  const open = await tasksApi.listOpen();
  return {
    needsAttention: open.filter((t) => t.backendStatus === "OFFERED").length,
    inProgress: open.filter((t) => t.backendStatus === "IN_PROGRESS").length,
    waitingOnCustomer: open.filter(
      (t) => t.backendStatus === "WAITING_FOR_USER",
    ).length,
  };
}
