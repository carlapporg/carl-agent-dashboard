import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { Task } from "@/types/task";

void API_ENDPOINTS;

export type ActivityLogKind =
  | "task_status"
  | "payment"
  | "handover"
  | "system"
  | "alert"
  | "voucher";

export type ActivityLogFilter = "all" | "system" | "handover";

export type ActivityLogItem = {
  id: string;
  kind: ActivityLogKind;
  title: string;
  body: string;
  taskLabel: string | null;
  actor: string;
  at: string;
  taskId?: string;
};

function stubLogs(): ActivityLogItem[] {
  return [
    {
      id: "act_1",
      kind: "task_status",
      title: "Task Status",
      body: "Agent Liam Anderson changed Task #T-2041 to 'In Progress'",
      taskLabel: "#T-2041",
      actor: "Liam Anderson",
      at: new Date(Date.now() - 15 * 60_000).toISOString(),
    },
    {
      id: "act_2",
      kind: "payment",
      title: "Payment",
      body: "Successfully processed Stripe escrow TXN-90210 ($350.00) for customer Ava Chen",
      taskLabel: "#T-2041",
      actor: "System Escrow",
      at: new Date(Date.now() - 90 * 60_000).toISOString(),
    },
    {
      id: "act_3",
      kind: "handover",
      title: "Handover",
      body: "System auto-assigned Task #T-2040 to agent Liam Anderson due to queue length",
      taskLabel: "#T-2040",
      actor: "Queue Manager",
      at: new Date(Date.now() - 28 * 3600_000).toISOString(),
    },
    {
      id: "act_4",
      kind: "system",
      title: "System Event",
      body: "Database optimization run completed successfully in 12ms",
      taskLabel: null,
      actor: "Admin Dev",
      at: new Date(Date.now() - 32 * 3600_000).toISOString(),
    },
    {
      id: "act_5",
      kind: "alert",
      title: "Alert Issued",
      body: "Customer Julian Drake filed ticket dispute #T-2039 for refund failure",
      taskLabel: "#T-2039",
      actor: "Julian Drake",
      at: "2026-10-24T16:00:00.000Z",
    },
    {
      id: "act_6",
      kind: "voucher",
      title: "Voucher Auth",
      body: "Special promo code 'LUXLAHO' loaded into active verification registers",
      taskLabel: null,
      actor: "Campaign Admin",
      at: "2026-10-22T12:00:00.000Z",
    },
  ];
}

function fromHistoryTasks(tasks: Task[]): ActivityLogItem[] {
  return tasks.map((task) => ({
    id: `hist_${task.id}`,
    kind: "task_status" as const,
    title: task.status === "completed" ? "Task Completed" : "Task Closed",
    body: `${task.title} for ${task.customerName} marked ${task.status.replaceAll("_", " ")}`,
    taskLabel: `#T-${task.number}`,
    actor: "Agent",
    at: task.completedAt ?? task.updatedAt,
    taskId: task.id,
  }));
}

/** Client-safe. Prefer Nest activity logs; merge finished tasks as timeline rows. */
export const activityLogsApi = {
  async list(historyTasks: Task[] = []): Promise<ActivityLogItem[]> {
    // TODO(backend): GET API_ENDPOINTS.agents.activityLogs
    const stubs = stubLogs();
    const fromTasks = fromHistoryTasks(historyTasks);
    return [...fromTasks, ...stubs].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  },
};
