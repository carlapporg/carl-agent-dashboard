import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import {
  addTimelineEvent,
  findTask,
  mockTasks,
  updateTask,
} from "@/mocks/data";
import {
  taskListSchema,
  taskSchema,
  type Task,
  type TaskListFilters,
  type TaskStatus,
} from "@/types/task";

function filterTasks(filters: TaskListFilters = {}): Task[] {
  let list = [...mockTasks];

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
        String(t.number).includes(q),
    );
  }

  return list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export const tasksApi = {
  async list(filters: TaskListFilters = {}): Promise<Task[]> {
    if (!env.isApiConfigured) {
      return filterTasks(filters);
    }

    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    if (filters.waitingOn && filters.waitingOn !== "all") {
      params.set("waitingOn", filters.waitingOn);
    }
    if (filters.search) params.set("search", filters.search);
    const qs = params.toString();
    return apiRequest(`${API_ENDPOINTS.tasks.list}${qs ? `?${qs}` : ""}`, {
      schema: taskListSchema,
    });
  },

  async get(taskId: string): Promise<Task> {
    if (!env.isApiConfigured) {
      const task = findTask(taskId);
      if (!task) {
        throw new Error("NOT_FOUND");
      }
      return task;
    }

    return apiRequest(API_ENDPOINTS.tasks.detail(taskId), {
      schema: taskSchema,
    });
  },

  async accept(taskId: string): Promise<Task> {
    if (!env.isApiConfigured) {
      const task = updateTask(taskId, {
        status: "in_progress",
        assignedAgentId: "agent_stub_001",
      });
      if (!task) throw new Error("NOT_FOUND");
      addTimelineEvent({
        taskId,
        kind: "status_change",
        body: "Task accepted — now in progress",
        visibleToCustomer: true,
      });
      return task;
    }

    return apiRequest(API_ENDPOINTS.tasks.accept(taskId), {
      method: "POST",
      schema: taskSchema,
      dedupe: false,
    });
  },

  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    if (!env.isApiConfigured) {
      const patch: Partial<Task> = { status };
      if (status === "completed") {
        patch.completedAt = new Date().toISOString();
      }
      const task = updateTask(taskId, patch);
      if (!task) throw new Error("NOT_FOUND");
      addTimelineEvent({
        taskId,
        kind: "status_change",
        body: `Status updated to ${status.replaceAll("_", " ")}`,
        visibleToCustomer: true,
      });
      return task;
    }

    return apiRequest(API_ENDPOINTS.tasks.status(taskId), {
      method: "PATCH",
      body: { status },
      schema: taskSchema,
      dedupe: false,
    });
  },

  async addNote(taskId: string, body: string): Promise<Task> {
    if (!env.isApiConfigured) {
      const existing = findTask(taskId);
      if (!existing) throw new Error("NOT_FOUND");
      const note = {
        id: `note_${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        authorName: "Alex Morgan",
      };
      const task = updateTask(taskId, {
        notes: [...existing.notes, note],
      });
      if (!task) throw new Error("NOT_FOUND");
      addTimelineEvent({
        taskId,
        kind: "agent_note",
        body,
        authorName: "Alex Morgan",
      });
      return task;
    }

    return apiRequest(API_ENDPOINTS.tasks.notes(taskId), {
      method: "POST",
      body: { body },
      schema: taskSchema,
      dedupe: false,
    });
  },

  async toggleStep(taskId: string, step: string): Promise<Task> {
    if (!env.isApiConfigured) {
      const existing = findTask(taskId);
      if (!existing) throw new Error("NOT_FOUND");
      const done = existing.suggestedStepsDone.includes(step)
        ? existing.suggestedStepsDone.filter((s) => s !== step)
        : [...existing.suggestedStepsDone, step];
      const task = updateTask(taskId, { suggestedStepsDone: done });
      if (!task) throw new Error("NOT_FOUND");
      return task;
    }

    return apiRequest(API_ENDPOINTS.tasks.steps(taskId), {
      method: "PATCH",
      body: { step },
      schema: taskSchema,
      dedupe: false,
    });
  },

  async listChildren(parentId: string): Promise<Task[]> {
    if (!env.isApiConfigured) {
      return mockTasks.filter((t) => t.parentId === parentId);
    }

    return apiRequest(`${API_ENDPOINTS.tasks.list}?parentId=${parentId}`, {
      schema: taskListSchema,
    });
  },
};

export const overviewStatsSchema = z.object({
  needsAttention: z.number(),
  inProgress: z.number(),
  waitingOnCustomer: z.number(),
});

export type OverviewStats = z.infer<typeof overviewStatsSchema>;

export async function getOverviewStats(): Promise<OverviewStats> {
  const tasks = await tasksApi.list();
  const roots = tasks.filter((t) => !t.parentId);
  return {
    needsAttention: roots.filter(
      (t) =>
        t.status === "queued" ||
        t.status === "waiting_for_payment" ||
        t.priority === "urgent",
    ).length,
    inProgress: roots.filter((t) => t.status === "in_progress").length,
    waitingOnCustomer: roots.filter(
      (t) => t.status === "waiting_for_customer",
    ).length,
  };
}
