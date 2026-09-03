import type { AgentPresence, AgentPresenceWrite } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

/** Session-only: agent explicitly chose Busy/Offline (survives refresh, not new login). */
const MANUAL_PRESENCE_KEY = "carl.agent.manual-presence";

export function normalizePresence(status: string | null | undefined): AgentPresence {
  const upper = typeof status === "string" ? status.trim().toUpperCase() : "";
  if (upper === "BUSY") return "BUSY";
  if (upper === "OFFLINE") return "OFFLINE";
  // Backend may return ONLINE instead of AVAILABLE.
  return "AVAILABLE";
}

export function readManualPresence(): AgentPresence | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MANUAL_PRESENCE_KEY);
    if (raw === "BUSY" || raw === "OFFLINE" || raw === "AVAILABLE") return raw;
  } catch {
    // Private mode / blocked storage.
  }
  return null;
}

export function writeManualPresence(status: AgentPresence): void {
  if (typeof window === "undefined") return;
  try {
    const next = normalizePresence(status);
    if (next === "AVAILABLE") {
      window.sessionStorage.removeItem(MANUAL_PRESENCE_KEY);
      return;
    }
    window.sessionStorage.setItem(MANUAL_PRESENCE_KEY, next);
  } catch {
    // Private mode / blocked storage.
  }
}

export function clearManualPresence(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MANUAL_PRESENCE_KEY);
  } catch {
    // Private mode / blocked storage.
  }
}

/**
 * While the agent uses the dashboard, default to AVAILABLE so Nest can assign
 * tasks after login / refresh / socket reconnect — unless they chose Busy/Offline.
 */
export function desiredPresenceForSession(
  fallback: AgentPresence = "AVAILABLE",
): AgentPresence {
  const manual = readManualPresence();
  if (manual === "OFFLINE" || manual === "BUSY") return manual;
  if (manual === "AVAILABLE") return "AVAILABLE";
  const normalized = normalizePresence(fallback);
  if (normalized === "BUSY") return "BUSY";
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
