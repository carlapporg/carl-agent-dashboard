/**
 * All Backend API routes for the Agent Dashboard.
 *
 * Change paths here only. Full URL = API_BASE_URL + these paths.
 * Do not put /api/v1 in these values — that prefix lives in API_BASE_URL.
 *
 * Paths marked "mock until live" are used by frontend mock adapters today.
 * Swap adapter bodies to apiRequest(...) when Backend ships.
 */
export const API_ENDPOINTS = {
  auth: {
    agentLogin: "/auth/agent/login",
    agentRegister: "/auth/agent/register",
  },
  agents: {
    me: "/agents/me",
    changePassword: "/agents/me/change-password",
    /** PATCH — Online | Busy | Offline (mock until live) */
    availability: "/agents/me/availability",
    /** GET/PATCH — skills, weekly schedule, notification prefs (mock until live) */
    preferences: "/agents/me/preferences",
    /** GET — performance metrics (mock until live) */
    metrics: "/agents/me/metrics",
    /** GET — quick stats day/week (mock until live) */
    stats: "/agents/me/stats",
    /** GET — queue preview limit=3 (mock until live) */
    queuePreview: "/agents/me/queue/preview",
    /** GET — active tasks summary (mock until live) */
    activeTasks: "/agents/me/tasks/active",
    /** GET — action-required alerts (mock until live) */
    alerts: "/agents/me/alerts",
    /** POST dismiss / snooze (mock until live) */
    alertDismiss: (id: string) => `/agents/me/alerts/${id}/dismiss` as const,
    alertSnooze: (id: string) => `/agents/me/alerts/${id}/snooze` as const,
    /** GET — aggregated conversations (mock until live) */
    conversations: "/agents/me/conversations",
    /** GET — notifications center (mock until live) */
    notifications: "/agents/me/notifications",
    /** Payments overview (mock until live) */
    paymentsPending: "/agents/me/payments/pending",
    paymentsCards: "/agents/me/payments/cards",
    paymentsTransactions: "/agents/me/payments/transactions",
  },
  tasks: {
    list: "/tasks",
    detail: (id: string) => `/tasks/${id}` as const,
    start: (id: string) => `/tasks/${id}/start` as const,
    complete: (id: string) => `/tasks/${id}/complete` as const,
    toggleStep: (id: string, stepId: string) =>
      `/tasks/${id}/steps/${stepId}/toggle` as const,
    messages: (id: string) => `/tasks/${id}/messages` as const,
    paymentRequests: (id: string) => `/tasks/${id}/payment-requests` as const,
    receipts: (id: string) => `/tasks/${id}/receipts` as const,
    itineraryGenerate: (id: string) =>
      `/tasks/${id}/itinerary/generate` as const,
    itinerarySend: (id: string) => `/tasks/${id}/itinerary/send` as const,
    actionLog: (id: string) => `/tasks/${id}/action-log` as const,
  },
  customers: {
    detail: (id: string) => `/customers/${id}` as const,
    notes: (id: string) => `/customers/${id}/notes` as const,
  },
} as const;
