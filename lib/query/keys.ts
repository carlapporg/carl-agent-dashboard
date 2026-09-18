/**
 * Query key factory — keep all cache keys here so invalidation stays consistent.
 */
export const queryKeys = {
  agents: {
    all: ["agents"] as const,
    me: () => [...queryKeys.agents.all, "me"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    lists: () => [...queryKeys.tasks.all, "list"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.tasks.lists(), filters] as const,
    /** Dashboard seed: offered + active + history. */
    dashboardSeed: () => [...queryKeys.tasks.lists(), "dashboard-seed"] as const,
    /** Task Hub full list. */
    hub: () => [...queryKeys.tasks.lists(), "hub"] as const,
    /** Open tasks for Chat Box. */
    open: () => [...queryKeys.tasks.lists(), "open"] as const,
    details: () => [...queryKeys.tasks.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  history: {
    all: ["history"] as const,
    logs: () => [...queryKeys.history.all, "logs"] as const,
  },
  timesheet: {
    all: ["timesheet"] as const,
    byQuery: (query: { date: string } | { from: string; to: string }) =>
      [...queryKeys.timesheet.all, query] as const,
  },
  calendar: {
    all: ["calendar"] as const,
    month: (query: { year: number; month: number }) =>
      [...queryKeys.calendar.all, "month", query] as const,
    week: (date: string) =>
      [...queryKeys.calendar.all, "week", date] as const,
    day: (date: string) => [...queryKeys.calendar.all, "day", date] as const,
    upcoming: (limit: number) =>
      [...queryKeys.calendar.all, "upcoming", limit] as const,
    availability: (
      query: { date: string } | { from: string; to: string },
    ) => [...queryKeys.calendar.all, "availability", query] as const,
  },
  payments: {
    all: ["payments"] as const,
    byTask: (taskId: string) => [...queryKeys.payments.all, taskId] as const,
  },
  earnings: {
    all: ["earnings"] as const,
    summary: (range: { from: string; to: string }) =>
      [...queryKeys.earnings.all, "summary", range] as const,
    tips: (range: { from: string; to: string }) =>
      [...queryKeys.earnings.all, "tips", range] as const,
    ledger: (range: { from: string; to: string }) =>
      [...queryKeys.earnings.all, "ledger", range] as const,
    hourlyRate: () => [...queryKeys.earnings.all, "hourly-rate"] as const,
  },
  adminChats: {
    all: ["admin-chats"] as const,
    lists: () => [...queryKeys.adminChats.all, "list"] as const,
    list: () => [...queryKeys.adminChats.lists()] as const,
    details: () => [...queryKeys.adminChats.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.adminChats.details(), id] as const,
  },
} as const;
