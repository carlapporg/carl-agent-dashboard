import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

const CHOSEN_PRESENCE_KEY = "carl.agent.chosen-presence";

export function readChosenPresence(): AgentPresence | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHOSEN_PRESENCE_KEY);
    if (raw === "AVAILABLE" || raw === "ONLINE" || raw === "BUSY" || raw === "OFFLINE") {
      return raw;
    }
  } catch {
    return null;
  }
  return null;
}

export function writeChosenPresence(status: AgentPresence) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHOSEN_PRESENCE_KEY, status);
  } catch {
    // Private mode / blocked storage.
  }
}

export function presenceToUi(status: AgentPresence): AgentAvailability {
  switch (status) {
    case "AVAILABLE":
      return "available";
    case "ONLINE":
      return "online";
    case "BUSY":
      return "busy";
    case "OFFLINE":
      return "offline";
  }
}

export function uiToPresence(status: AgentAvailability): AgentPresenceWrite {
  switch (status) {
    case "available":
      return "AVAILABLE";
    case "online":
      return "ONLINE";
    case "busy":
      return "BUSY";
    case "offline":
      return "OFFLINE";
  }
}

export function writeToPresence(status: AgentPresenceWrite): AgentPresence {
  return status;
}
