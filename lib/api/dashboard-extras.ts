import { API_ENDPOINTS } from "@/lib/api/endpoints";

/**
 * Placeholder extras until Nest ships these routes.
 * Paths live in API_ENDPOINTS — swap to apiRequest when backend is ready.
 * This module must stay client-safe (no lib/api/client → next/headers).
 * Tasks-per-hour uses getTasksPerHourAction (server) instead.
 */
void API_ENDPOINTS;

export type TaskChatMeta = { bookingRef: string | null };

function stubChatMeta(taskId: string): TaskChatMeta {
  const short = taskId.replace(/-/g, "").slice(0, 5).toUpperCase();
  return { bookingRef: `LH-${short}` };
}

export const dashboardExtrasApi = {
  async getTaskChatMeta(taskId: string): Promise<TaskChatMeta> {
    // TODO(backend): GET API_ENDPOINTS.agents.taskChatMeta(taskId)
    return stubChatMeta(taskId);
  },
};
