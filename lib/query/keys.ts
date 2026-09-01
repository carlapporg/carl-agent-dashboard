/**
 * Query key factory — keep all cache keys here so invalidation stays consistent.
 *
 * Future feature:
 *   queryKeys.tasks.list(filters)
 *   queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
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
    details: () => [...queryKeys.tasks.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  payments: {
    all: ["payments"] as const,
    byTask: (taskId: string) => [...queryKeys.payments.all, taskId] as const,
  },
  adminChats: {
    all: ["admin-chats"] as const,
    lists: () => [...queryKeys.adminChats.all, "list"] as const,
    list: () => [...queryKeys.adminChats.lists()] as const,
    details: () => [...queryKeys.adminChats.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.adminChats.details(), id] as const,
  },
} as const;
