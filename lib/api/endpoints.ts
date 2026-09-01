/**
 * Nest agent API. Base = API_BASE_URL ({origin}/api/v1).
 * Auth: Bearer accessToken. Success envelope { data }.
 */

export const API_ENDPOINTS = {
  auth: {
    /** POST { email, password, firstName?, lastName? } → user, no tokens */
    agentRegister: "/auth/agent/register",
    /** POST { email, password } → { accessToken, refreshToken, user } */
    agentLogin: "/auth/agent/login",
    /** POST { refreshToken } or cookie → new token pair */
    refresh: "/auth/refresh",
    /** POST { refreshToken } or cookie */
    logout: "/auth/logout",
  },

  agents: {
    /** GET current agent */
    me: "/agents/me",
    /** PATCH { firstName?, lastName? } */
    meUpdate: "/agents/me",
    /** POST { currentPassword, newPassword } — revokes refresh tokens */
    changePassword: "/agents/me/change-password",
    /** GET | PATCH { status: AVAILABLE|BUSY|OFFLINE } */
    availability: "/agents/me/availability",
    /** GET | PATCH { skills, isGeneralist? } */
    skills: "/agents/me/skills",
    /** GET ?status=OFFERED|ACTIVE|HISTORY — status is required */
    tasks: "/agents/me/tasks",
    task: (taskId: string) => `/agents/me/tasks/${taskId}` as const,
    /** POST { title?, content } */
    taskNotes: (taskId: string) =>
      `/agents/me/tasks/${taskId}/notes` as const,
    /** GET one | PATCH { title?, content? } */
    taskNote: (taskId: string, noteId: string) =>
      `/agents/me/tasks/${taskId}/notes/${noteId}` as const,
    /** POST — OFFERED → ASSIGNED. No body. */
    taskAccept: (taskId: string) =>
      `/agents/me/tasks/${taskId}/accept` as const,
    /** POST { reason } — OFFERED only. Nest reassigns as ASSIGNED. */
    taskReject: (taskId: string) =>
      `/agents/me/tasks/${taskId}/reject` as const,
    /** POST — ASSIGNED → IN_PROGRESS. No body. */
    taskStart: (taskId: string) =>
      `/agents/me/tasks/${taskId}/start` as const,
    /** PATCH { status: IN_PROGRESS|COMPLETED|FAILED|CANCELLED|WAITING_FOR_USER, note? } */
    taskStatus: (taskId: string) =>
      `/agents/me/tasks/${taskId}/status` as const,
    /**
     * GET latest confirmation (any status).
     * POST { notes, cost, currency? } — AI formats a table for the user.
     * 404 on GET means none sent yet.
     */
    taskConfirmation: (taskId: string) =>
      `/agents/me/tasks/${taskId}/confirmation` as const,
    /**
     * GET latest receipt (any status). 404 if none.
     * POST multipart { file, note? } — booking confirmation must be CONFIRMED.
     */
    taskReceipt: (taskId: string) =>
      `/agents/me/tasks/${taskId}/receipt` as const,
    /** GET one receipt by id. */
    taskReceiptById: (taskId: string, receiptId: string) =>
      `/agents/me/tasks/${taskId}/receipts/${receiptId}` as const,
    /** GET raw file bytes. Use agentFileUrl. */
    taskReceiptFile: (taskId: string, receiptId: string) =>
      `/agents/me/tasks/${taskId}/receipts/${receiptId}/file` as const,
    /** GET list | POST { content } */
    taskMessages: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages` as const,
    /** POST multipart { file, durationMs? } */
    taskMessageVoice: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages/voice` as const,
    /** POST multipart { file, caption? } */
    taskMessageImage: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages/image` as const,
    /** GET raw audio */
    taskMessageAudio: (taskId: string, messageId: string) =>
      `/agents/me/tasks/${taskId}/messages/${messageId}/audio` as const,
    /** GET raw image */
    taskMessageImageFile: (taskId: string, messageId: string) =>
      `/agents/me/tasks/${taskId}/messages/${messageId}/image` as const,

    /**
     * Admin ↔ agent chat (text only).
     * POST { subject?, message? } → open/get OPEN chat
     * GET list | GET :id (detail + messages) | GET :id/messages | POST :id/messages | POST :id/read
     */
    adminChats: "/agents/me/admin-chats",
    adminChat: (id: string) => `/agents/me/admin-chats/${id}` as const,
    adminChatMessages: (id: string) =>
      `/agents/me/admin-chats/${id}/messages` as const,
    adminChatRead: (id: string) =>
      `/agents/me/admin-chats/${id}/read` as const,
  },

  notifications: {
    /** PUT { token } */
    fcmToken: "/notifications/fcm-token",
  },
} as const;
