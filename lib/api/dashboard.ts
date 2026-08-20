import type {
  ActiveTaskSummary,
  AgentAlert,
  AgentAvailability,
  AgentQuickStats,
  ConversationSummary,
  NotificationItem,
  QueuePreviewItem,
} from "@/types/dashboard";
import { mockTasks, mockPayments, mockTimeline, mockCards } from "@/mocks/data";
import { hasStartedWork } from "@/features/tasks/lib/workflow";

const AVAIL_KEY = "carl.agent.availability";

export function readLocalAvailability(): AgentAvailability {
  if (typeof window === "undefined") return "online";
  try {
    const v = window.localStorage.getItem(AVAIL_KEY);
    if (v === "online" || v === "busy" || v === "offline") return v;
  } catch {
    /* ignore */
  }
  return "online";
}

export function writeLocalAvailability(status: AgentAvailability) {
  try {
    window.localStorage.setItem(AVAIL_KEY, status);
  } catch {
    /* ignore */
  }
}

function isoPlusMins(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

/** Mock adapters — swap to apiRequest(API_ENDPOINTS...) when Backend is live. */
export const dashboardApi = {
  async getQueuePreview(limit = 3): Promise<QueuePreviewItem[]> {
    const incoming = mockTasks
      .filter((t) => !t.parentId)
      .filter(
        (t) =>
          t.status === "queued" ||
          t.status === "assigned" ||
          t.priority === "urgent",
      )
      .slice(0, limit)
      .map((t, i) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        summary: t.aiBrief?.summary ?? t.request,
        taskType: t.title.toLowerCase().includes("hotel")
          ? "Travel"
          : t.title.toLowerCase().includes("pharmacy")
            ? "Errand"
            : "General",
        tier:
          t.priority === "urgent"
            ? ("vip" as const)
            : ("standard" as const),
        priority: t.priority,
        expiresAt: isoPlusMins(8 + i * 4),
        estimatedComplexity:
          t.priority === "urgent"
            ? ("high" as const)
            : t.priority === "high"
              ? ("medium" as const)
              : ("low" as const),
      }));
    return incoming;
  },

  async getActiveTasks(): Promise<ActiveTaskSummary[]> {
    const roots = mockTasks.filter((t) => !t.parentId && hasStartedWork(t));
    const items: ActiveTaskSummary[] = roots.map((t) => {
      const unread = mockTimeline.filter(
        (e) =>
          e.taskId === t.id &&
          e.kind === "customer_message",
      ).length;
      const pendingApproval = mockPayments.filter(
        (p) => p.taskId === t.id && p.status === "pending",
      ).length;
      const actionRequired =
        t.status === "waiting_for_payment" ||
        t.status === "waiting_for_customer" ||
        unread > 0 ||
        pendingApproval > 0;
      return {
        id: t.id,
        number: t.number,
        title: t.title,
        customerLabel: t.customerName.split(" ")[0] ?? "Client",
        stage: t.status.replaceAll("_", " "),
        status: t.status,
        priority: t.priority,
        urgency:
          t.priority === "urgent"
            ? "urgent"
            : t.priority === "high"
              ? "high"
              : t.priority === "low"
                ? "low"
                : "normal",
        unreadCount: Math.min(unread, 3) || (actionRequired && t.status === "waiting_for_customer" ? 1 : 0),
        pendingApprovalCount: pendingApproval,
        actionRequired,
      };
    });

    return items.sort((a, b) => {
      if (a.actionRequired !== b.actionRequired) {
        return a.actionRequired ? -1 : 1;
      }
      return 0;
    });
  },

  async getAlerts(): Promise<AgentAlert[]> {
    return [
      {
        id: "alert_1",
        kind: "payment_approved",
        title: "Payment approved",
        body: "Client approved the payment request. Virtual card is ready.",
        taskId: "task_4821",
        panel: "payment",
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
      {
        id: "alert_2",
        kind: "sla_reply",
        title: "Reply SLA warning",
        body: "Client messaged over 15 minutes ago with no agent reply.",
        taskId: "task_4815",
        panel: "chat",
        createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      },
      {
        id: "alert_3",
        kind: "payment_declined",
        title: "Payment declined",
        body: "Client declined a payment request on an active task.",
        taskId: "task_4821",
        panel: "payment",
        createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      },
    ];
  },

  async getQuickStats(): Promise<AgentQuickStats> {
    const completed = mockTasks.filter(
      (t) => !t.parentId && t.status === "completed",
    ).length;
    return {
      completedToday: Math.max(completed, 1),
      completedWeek: Math.max(completed + 4, 5),
      avgResponseMins: 6,
      ratingAvg: 4.8,
    };
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const byTask = new Map<string, ConversationSummary>();
    for (const e of mockTimeline) {
      const task = mockTasks.find((t) => t.id === e.taskId);
      if (!task || task.parentId) continue;
      const existing = byTask.get(task.id);
      const at = e.createdAt;
      if (
        !existing ||
        new Date(at).getTime() > new Date(existing.lastActivityAt).getTime()
      ) {
        byTask.set(task.id, {
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
          taskStatus: task.status,
          lastMessage: e.body,
          lastActivityAt: at,
          unreadCount:
            e.kind === "customer_message" ? 1 : existing?.unreadCount ?? 0,
        });
      }
    }
    return [...byTask.values()].sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const alerts = await this.getAlerts();
    return alerts.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      read: false,
      taskId: a.taskId,
      panel: a.panel,
    }));
  },

  async getPaymentsOverview() {
    const pending = mockPayments.filter((p) => p.status === "pending");
    const cards = [...mockCards];
    const transactions = mockPayments.map((p) => ({
      id: p.id,
      taskId: p.taskId,
      amount: p.amount,
      merchant: p.merchant,
      status: p.status,
      at: p.approvedAt ?? p.requestedAt,
      needsReconcile: p.status === "approved" && p.remaining === p.amount,
    }));
    return { pending, cards, transactions };
  },

  async getAgentPreferences() {
    return {
      skills: ["Travel", "Errands", "Dining", "Hotels"],
      schedule: [
        { day: "Mon", start: "09:00", end: "17:00", enabled: true },
        { day: "Tue", start: "09:00", end: "17:00", enabled: true },
        { day: "Wed", start: "09:00", end: "17:00", enabled: true },
        { day: "Thu", start: "09:00", end: "17:00", enabled: true },
        { day: "Fri", start: "09:00", end: "15:00", enabled: true },
        { day: "Sat", start: "10:00", end: "14:00", enabled: false },
        { day: "Sun", start: "10:00", end: "14:00", enabled: false },
      ],
      notifications: {
        taskAssigned: true,
        paymentResult: true,
        slaWarning: true,
        customerReply: true,
        desktop: true,
        sound: false,
      },
    };
  },

  async getAgentMetrics() {
    return {
      completedWeek: 12,
      avgResponseMins: 6,
      ratingAvg: 4.8,
      onTimeRate: 0.94,
    };
  },

  countActiveTasks(): number {
    return mockTasks.filter((t) => !t.parentId && hasStartedWork(t)).length;
  },
};
