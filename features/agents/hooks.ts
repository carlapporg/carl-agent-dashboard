"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentAgent } from "@/features/agents/server";
import { updateAgentNameAction } from "@/features/profile/actions/profile-actions";
import { queryKeys } from "@/lib/query/keys";
import type { BackendUser } from "@/types/user";

export function useAgentMe(initialUser?: BackendUser) {
  return useQuery({
    queryKey: queryKeys.agents.me(),
    queryFn: fetchCurrentAgent,
    staleTime: 5 * 60_000,
    placeholderData: initialUser,
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
