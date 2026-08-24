import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

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
