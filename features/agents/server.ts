"use server";

import { agentsApi } from "@/lib/api/agents";
import type { BackendUser } from "@/types/user";

export async function fetchCurrentAgent(): Promise<BackendUser> {
  return agentsApi.me();
}
