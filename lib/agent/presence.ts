import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

const CHOSEN_PRESENCE_KEY = "carl.agent.chosen-presence";

let chosenPresence: AgentPresence | null = null;

function dropLegacyStore() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHOSEN_PRESENCE_KEY);
  } catch {
    // Private mode / blocked storage.
  }
}

dropLegacyStore();

export function normalizePresence(status: string | null | undefined): AgentPresence {
  if (status === "BUSY") return "BUSY";
  if (status === "OFFLINE") return "OFFLINE";
  return "AVAILABLE";
}

export function readChosenPresence(): AgentPresence | null {
  return chosenPresence;
}

export function writeChosenPresence(status: AgentPresence) {
  chosenPresence = normalizePresence(status);
}

export function presenceToUi(status: AgentPresence): AgentAvailability {
  switch (normalizePresence(status)) {
    case "BUSY":
      return "busy";
    case "OFFLINE":
      return "offline";
    default:
      return "available";
  }
}

export function uiToPresence(status: AgentAvailability): AgentPresenceWrite {
  switch (status) {
    case "busy":
      return "BUSY";
    case "offline":
      return "OFFLINE";
    default:
      return "AVAILABLE";
  }
}

export function writeToPresence(status: AgentPresenceWrite): AgentPresence {
  return normalizePresence(status);
}
