import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

/** GET availability fallback only. Never infer Busy from tasks. */
export function inferPresence(_tasks: Task[]): AgentPresence {
  return "AVAILABLE";
}
