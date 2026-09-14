"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardSeedTasksAction,
  getOpenTasksAction,
  getTaskHubTasksAction,
} from "@/features/dashboard/actions";
import { getHistoryLogsAction } from "@/features/history/actions";
import { queryKeys } from "@/lib/query/keys";

/** Keep lists warm ~1 min; revisit shows cache, refetch only when stale. */
const PAGE_STALE_MS = 60_000;

const pageQueryOptions = {
  staleTime: PAGE_STALE_MS,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  /** Fresh cache → instant paint, no network. Stale → show cache + background fetch. */
  refetchOnMount: true as const,
};

export function useDashboardSeedTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.dashboardSeed(),
    queryFn: getDashboardSeedTasksAction,
    ...pageQueryOptions,
  });
}

export function useTaskHubTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.hub(),
    queryFn: getTaskHubTasksAction,
    ...pageQueryOptions,
  });
}

export function useOpenTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.open(),
    queryFn: getOpenTasksAction,
    ...pageQueryOptions,
  });
}

export function useHistoryLogs() {
  return useQuery({
    queryKey: queryKeys.history.logs(),
    queryFn: getHistoryLogsAction,
    ...pageQueryOptions,
  });
}

/** Mark list caches stale after accept/reject/complete so background sync picks up. */
export function useInvalidateTaskPageQueries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
  };
}
