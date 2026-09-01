import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

export function normalizePresence(status: string | null | undefined): AgentPresence {
  const upper = typeof status === "string" ? status.trim().toUpperCase() : "";
  if (upper === "BUSY") return "BUSY";
  if (upper === "OFFLINE") return "OFFLINE";
  // Backend may return ONLINE instead of AVAILABLE.
  return "AVAILABLE";
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
