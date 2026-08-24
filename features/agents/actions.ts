"use server";

import { revalidatePath } from "next/cache";
import { agentsApi } from "@/lib/api/agents";
import { ROUTES } from "@/lib/constants/routes";
import type { AgentPresence, AgentPresenceState, AgentPresenceWrite } from "@/types/agent";

export async function getAvailabilityAction(): Promise<AgentPresenceState> {
  return agentsApi.getAvailability();
}

export async function getPresenceHintAction(): Promise<AgentPresence> {
  const row = await getAvailabilityAction();
  return row.status;
}

export async function setAvailabilityAction(status: AgentPresenceWrite) {
  return agentsApi.setAvailability(status);
}

export async function saveSkillsAction(skills: string[], isGeneralist: boolean) {
  const result = await agentsApi.setSkills({ skills, isGeneralist });
  revalidatePath(ROUTES.profile);
  return result;
}
