"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentAgent } from "@/features/agents/server";
import { updateAgentNameAction } from "@/features/profile/actions/profile-actions";
import { queryKeys } from "@/lib/query/keys";
import type { BackendUser } from "@/types/user";

/**
 * Agent profile query.
 * - No automatic refetch every 5 minutes (Backend has no token refresh yet).
 * - Fresh data only on first load (empty cache) or after name update / logout.
 */
export function useAgentMe(initialUser?: BackendUser) {
  return useQuery({
    queryKey: queryKeys.agents.me(),
    queryFn: fetchCurrentAgent,
    // Keep until logout / explicit invalidate — avoids 401 after access token ages out.
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    // Hydration-safe seed from session (server + client same first paint).
    ...(initialUser
      ? {
          initialData: initialUser,
          // Prefer existing cache if already fetched (e.g. after login me()).
          initialDataUpdatedAt: 0,
        }
      : {}),
  });
}

export function useUpdateAgentName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const result = await updateAgentNameAction(undefined, formData);
      if (!result?.success || !result.user) {
        throw new Error(result?.message ?? "Couldn’t save your name.");
      }
      return result.user;
    },
    onSuccess: (user: BackendUser) => {
      queryClient.setQueryData(queryKeys.agents.me(), user);
    },
  });
}

export function useClearAppCache() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.clear();
  };
}
