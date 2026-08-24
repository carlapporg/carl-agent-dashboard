import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

/** Fallback only if GET availability fails: BUSY when live work exists. */
export function inferPresence(tasks: Task[]): AgentPresence {
  const busy = tasks.some(
    (task) =>
      task.backendStatus === "ASSIGNED" ||
      task.backendStatus === "IN_PROGRESS" ||
      task.backendStatus === "WAITING_FOR_USER" ||
      task.backendStatus === "WAITING_FOR_AGENT",
  );
  return busy ? "BUSY" : "ONLINE";
}
