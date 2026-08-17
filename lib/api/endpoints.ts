export const API_ENDPOINTS = {
  auth: {
    agentLogin: "/auth/agent/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
  },
  agents: {
    me: "/agents/me",
    changePassword: "/agents/me/change-password",
  },
  tasks: {
    list: "/tasks",
    detail: (id: string) => `/tasks/${id}`,
    accept: (id: string) => `/tasks/${id}/accept`,
    status: (id: string) => `/tasks/${id}/status`,
    notes: (id: string) => `/tasks/${id}/notes`,
    steps: (id: string) => `/tasks/${id}/steps`,
  },
  customers: {
    profile: (id: string) => `/customers/${id}`,
    history: (id: string) => `/customers/${id}/history`,
  },
  messages: {
    list: (taskId: string) => `/tasks/${taskId}/messages`,
    send: (taskId: string) => `/tasks/${taskId}/messages`,
  },
  payments: {
    list: (taskId: string) => `/tasks/${taskId}/payments`,
    requestApproval: (taskId: string) =>
      `/tasks/${taskId}/payments/request-approval`,
    card: (taskId: string) => `/tasks/${taskId}/card`,
    markPaid: (taskId: string) => `/tasks/${taskId}/payments/mark-paid`,
  },
  receipts: {
    list: (taskId: string) => `/tasks/${taskId}/receipts`,
    upload: (taskId: string) => `/tasks/${taskId}/receipts`,
  },
  itinerary: {
    get: (parentTaskId: string) => `/tasks/${parentTaskId}/itinerary`,
    generate: (parentTaskId: string) =>
      `/tasks/${parentTaskId}/itinerary/generate`,
  },
} as const;
