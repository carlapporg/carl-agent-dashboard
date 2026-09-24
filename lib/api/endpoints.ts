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
    /** POST multipart avatar | GET proxy stream */
    meAvatar: "/agents/me/avatar",
    avatar: (agentId: string) => `/agents/${agentId}/avatar` as const,
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
     * GET latest confirmation (prefers DRAFT, else latest).
     * POST { notes?, cost, currency? } — legacy one-shot (draft + send). Prefer draft → send.
     * 404 on GET means none yet.
     */
    taskConfirmation: (taskId: string) =>
      `/agents/me/tasks/${taskId}/confirmation` as const,
    /** POST { notes?, cost, currency?, suggestionId?, …fields } → DRAFT with backend preview rows. */
    taskConfirmationDraft: (taskId: string) =>
      `/agents/me/tasks/${taskId}/confirmation/draft` as const,
    /** POST — DRAFT → PENDING; notifies user; task → WAITING_FOR_USER. */
    taskConfirmationSend: (taskId: string, confirmationId: string) =>
      `/agents/me/tasks/${taskId}/confirmation/${confirmationId}/send` as const,
    /**
     * POST — re-run Places/Nominatim search; stores results on task.metadata.venueSuggestions.
     * Body empty. Returns { query, suggestions, metadata }.
     */
    taskVenueSuggestionsRefresh: (taskId: string) =>
      `/agents/me/tasks/${taskId}/venue-suggestions/refresh` as const,
    /**
     * GET latest receipt/document (any status). 404 if none.
     * POST multipart { file, note? } — booking confirmation must be CONFIRMED.
     * Client approval is not required; replace by posting again.
     */
    taskReceipt: (taskId: string) =>
      `/agents/me/tasks/${taskId}/receipt` as const,
    /** GET one receipt by id. */
    taskReceiptById: (taskId: string, receiptId: string) =>
      `/agents/me/tasks/${taskId}/receipts/${receiptId}` as const,
    /** GET raw file bytes. Use agentFileUrl. */
    taskReceiptFile: (taskId: string, receiptId: string) =>
      `/agents/me/tasks/${taskId}/receipts/${receiptId}/file` as const,
    /**
     * Booking payment + one-time Issuing card (after CONFIRMED confirmation).
     * POST { spendAmountCents, currency?, confirmationId? }
     * GET  …/payments/:paymentId/card
     * POST …/payments/:paymentId/cancel
     */
    taskPayments: (taskId: string) =>
      `/agents/me/tasks/${taskId}/payments` as const,
    taskPaymentCard: (taskId: string, paymentId: string) =>
      `/agents/me/tasks/${taskId}/payments/${paymentId}/card` as const,
    taskPaymentCancel: (taskId: string, paymentId: string) =>
      `/agents/me/tasks/${taskId}/payments/${paymentId}/cancel` as const,
    /** GET list | POST { content } */
    taskMessages: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages` as const,
    /** POST — mark customer messages DELIVERED on this device */
    taskMessagesDelivered: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages/delivered` as const,
    /** POST — mark customer messages SEEN (chat open) */
    taskMessagesRead: (taskId: string) =>
      `/agents/me/tasks/${taskId}/messages/read` as const,
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

    /**
     * Dashboard analytics.
     * overview: period cards + Task Progress
     * tasksPerHour: Task Hour chart (`range` query; default today = 24 points)
     */
    dashboardOverview: "/agents/me/dashboard/overview",
    tasksPerHour: "/agents/me/dashboard/tasks-per-hour",
    taskChatMeta: (taskId: string) =>
      `/agents/me/tasks/${taskId}/chat-meta` as const,
    /** Placeholder payments overview until Nest ships ledger APIs. */
    paymentsSummary: "/agents/me/payments/summary",
    paymentsTransactions: "/agents/me/payments/transactions",
    /** Activity / audit log for History (hand-over, task_status, …). */
    activityLogs: "/agents/me/activity-logs",
    /** In-app notifications (bell + History → Notifications). */
    notifications: "/agents/me/notifications",
    notificationRead: (id: string) =>
      `/agents/me/notifications/${id}/read` as const,
    notificationsReadAll: "/agents/me/notifications/read-all",
    /** GET Work Diary / timesheet (?date= or ?from=&to=, max 31 days). */
    timesheet: "/agents/me/timesheet",
    /** Agent calendar (schedule events + presence). */
    calendar: "/agents/me/calendar",
    calendarWeek: "/agents/me/calendar/week",
    calendarDay: "/agents/me/calendar/day",
    calendarUpcoming: "/agents/me/calendar/upcoming",
    calendarAvailability: "/agents/me/calendar/availability",
    /** GET earnings summary / tips / rate / ledger. Read-only for agents. */
    earnings: "/agents/me/earnings",
    earningsTips: "/agents/me/earnings/tips",
    earningsHourlyRate: "/agents/me/earnings/hourly-rate",
    earningsLedger: "/agents/me/earnings/ledger",
    /** Agent payout / Stripe Connect + manual ACH bank. */
    payoutSettings: "/agents/me/payout-settings",
    payoutConnectLink: "/agents/me/payout-settings/connect-link",
    payoutLoginLink: "/agents/me/payout-settings/login-link",
    payoutBank: "/agents/me/payout-settings/bank",
    payoutBankClear: "/agents/me/payout-settings/bank/clear",
    payoutDisconnect: "/agents/me/payout-settings/disconnect",
    /** Profile extras until Nest expands /agents/me. */
    profileStats: "/agents/me/profile/stats",
    profileDetails: "/agents/me/profile/details",
    profileActivity: "/agents/me/profile/activity",
    /** Settings placeholders. */
    appSettings: "/agents/me/settings",
    revokeSessions: "/agents/me/revoke-sessions",
  },

  /** Canonical task types + confirmation schemas (optional catalog). */
  tasks: {
    types: "/tasks/types",
    confirmationSchemas: "/tasks/confirmation-schemas",
  },

  notifications: {
    /** PUT { token } — FCM push only (not the in-app list). */
    fcmToken: "/notifications/fcm-token",
  },

  /** LiveKit calls (agent ↔ customer on a task). */
  calls: {
    root: "/calls",
    one: (id: string) => `/calls/${id}` as const,
    accept: (id: string) => `/calls/${id}/accept` as const,
    reject: (id: string) => `/calls/${id}/reject` as const,
    end: (id: string) => `/calls/${id}/end` as const,
    token: (id: string) => `/calls/${id}/token` as const,
  },
} as const;
