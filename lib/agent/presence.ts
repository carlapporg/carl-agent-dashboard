import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

const CHOSEN_PRESENCE_KEY = "carl.agent.chosen-presence";

export function normalizePresence(status: string | null | undefined): AgentPresence {
  if (status === "BUSY") return "BUSY";
  if (status === "OFFLINE") return "OFFLINE";
  return "AVAILABLE";
}

export function readChosenPresence(): AgentPresence | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHOSEN_PRESENCE_KEY);
    if (raw === "AVAILABLE" || raw === "ONLINE" || raw === "BUSY" || raw === "OFFLINE") {
      return normalizePresence(raw);
    }
  } catch {
    return null;
  }
  return null;
}

export function writeChosenPresence(status: AgentPresence) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHOSEN_PRESENCE_KEY, normalizePresence(status));
  } catch {
    // Private mode / blocked storage.
  }
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
