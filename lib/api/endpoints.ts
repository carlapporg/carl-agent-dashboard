/**
 * Agent API paths. Full URL = API_BASE_URL + path (/api/v1 already on the base).
 *
 * Auth + GET/PATCH /agents/me + change-password are already live.
 * Inbox, skills, availability, task actions, chat, refresh, logout: wired here.
 */

export const API_ENDPOINTS = {
  auth: {
    /** POST { email, password } → { accessToken, refreshToken, user } */
    agentLogin: "/auth/agent/login",
    /** POST { email, password, firstName?, lastName? } → user (no tokens; login next) */
    agentRegister: "/auth/agent/register",
    /** POST { refreshToken } → new token pair. Old refresh token dies. */
    refresh: "/auth/refresh",
    /** POST { refreshToken } → invalidate refresh session */
    logout: "/auth/logout",
  },

  agents: {
    /** GET → current agent user */
    me: "/agents/me",
    /** PATCH { firstName?, lastName? } */
    meUpdate: "/agents/me",
    /** POST { currentPassword, newPassword } — revokes all refresh tokens */
    changePassword: "/agents/me/change-password",
    /** GET current presence | PATCH { status: AVAILABLE|ONLINE|BUSY|OFFLINE } */
    availability: "/agents/me/availability",
    /** GET → { isGeneralist, skills } */
    skills: "/agents/me/skills",
    /**
     * GET ?status=OFFERED|ACTIVE|HISTORY
     * OFFERED = ASSIGNED, ACTIVE = in-flight, HISTORY = done/failed/cancelled/rejected
     */
    tasks: "/agents/me/tasks",
    /** GET one task (anonymized client). 403 if not yours. */
    task: (taskId: string) => `/agents/me/tasks/${taskId}` as const,
    /** POST { reason } — only ASSIGNED and within 60s of offer */
    taskReject: (taskId: string) =>
      `/agents/me/tasks/${taskId}/reject` as const,
    /** POST — ASSIGNED → IN_PROGRESS. No body. */
    taskStart: (taskId: string) => `/agents/me/tasks/${taskId}/start` as const,
    /**
     * PATCH { status, note? }
     * status: COMPLETED | FAILED | CANCELLED | WAITING_FOR_USER
     * Do not use this to start — use taskStart.
     */
    taskStatus: (taskId: string) =>
      `/agents/me/tasks/${taskId}/status` as const,
    /** GET list | POST { content } */
    taskMessages: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages` as const,
  },

  notifications: {
    fcmToken: "/notifications/fcm-token",
  },
} as const;
