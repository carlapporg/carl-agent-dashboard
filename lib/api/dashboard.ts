import type {
  ActiveTaskSummary,
  AgentAlert,
  AgentQuickStats,
  ConversationSummary,
  NotificationItem,
  QueuePreviewItem,
} from "@/types/dashboard";
import { presenceToUi, uiToPresence } from "@/lib/agent/presence";
import { messagesApi } from "@/lib/api/messages";
import { tasksApi } from "@/lib/api/tasks";
import { agentsApi } from "@/lib/api/agents";
import type { Task } from "@/types/task";

export { presenceToUi, uiToPresence };

function toQueueItem(task: Task): QueuePreviewItem {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    summary: task.aiBrief?.summary ?? task.request,
    taskType: task.taskType ?? "TASK",
    priority: task.priority,
    expiresAt: task.expiresAt ?? task.updatedAt,
  };
}

function toActiveSummary(task: Task): ActiveTaskSummary {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    customerLabel: task.customerName,
    stage: (task.backendStatus ?? task.status).replaceAll("_", " "),
    status: task.status,
    priority: task.priority,
    urgency: "normal",
    unreadCount: 0,
    pendingApprovalCount: 0,
    actionRequired:
      task.backendStatus === "ASSIGNED" ||
      task.backendStatus === "WAITING_FOR_AGENT" ||
      task.status === "assigned",
  };
}

export const dashboardApi = {
  async getQueuePreview(limit = 3): Promise<QueuePreviewItem[]> {
    const offered = await tasksApi.listByInbox("OFFERED");
    return offered.slice(0, limit).map(toQueueItem);
  },

  async getActiveTasks(): Promise<ActiveTaskSummary[]> {
    const active = await tasksApi.listByInbox("ACTIVE");
    return active.map(toActiveSummary);
  },

  async getAlerts(): Promise<AgentAlert[]> {
    const offered = await tasksApi.listByInbox("OFFERED");
    return offered.map((task) => ({
      id: `offer-${task.id}`,
      kind: "task_assigned" as const,
      title: "New task assigned",
      body: task.title,
      taskId: task.id,
      panel: "brief" as const,
      createdAt: task.updatedAt,
    }));
  },

  async getQuickStats(): Promise<AgentQuickStats> {
    const history = await tasksApi.listByInbox("HISTORY");
    const completed = history.filter((t) => t.status === "completed");
    return {
      completedToday: completed.length,
      completedWeek: completed.length,
      avgResponseMins: 0,
      ratingAvg: null,
    };
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const [offered, active] = await Promise.all([
      tasksApi.listByInbox("OFFERED"),
      tasksApi.listByInbox("ACTIVE"),
    ]);
    const tasks = [...offered, ...active];
    const conversations: ConversationSummary[] = [];
    for (const task of tasks) {
      const timeline = await messagesApi.list(task.id).catch(() => []);
      const last = timeline[timeline.length - 1];
      conversations.push({
        taskId: task.id,
        taskNumber: task.number,
        taskTitle: task.title,
        taskStatus: task.status,
        lastMessage: last?.body ?? "No messages yet",
        lastActivityAt: last?.createdAt ?? task.updatedAt,
        unreadCount: 0,
      });
    }
    return conversations.sort(
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

  async getPaymentsOverview(): Promise<{
    pending: Array<{
      id: string;
      taskId: string;
      amount: number;
      merchant: string;
    }>;
    cards: Array<{
      id: string;
      taskId: string;
      network: string;
      last4: string;
      remaining: number;
      spendingLimit: number;
    }>;
    transactions: Array<{
      id: string;
      taskId: string;
      amount: number;
      merchant: string;
      status: string;
      at: string;
      needsReconcile?: boolean;
    }>;
  }> {
    return { pending: [], cards: [], transactions: [] };
  },

  async getAgentPreferences() {
    const skills = await agentsApi.getSkills();
    return {
      skills: skills.skills,
      isGeneralist: skills.isGeneralist,
      schedule: [] as Array<{
        day: string;
        enabled: boolean;
        start: string;
        end: string;
      }>,
      notifications: {
        taskAssigned: true,
        paymentResult: false,
        slaWarning: true,
        customerReply: true,
        desktop: false,
        sound: false,
      },
    };
  },

  async getAgentMetrics() {
    const history = await tasksApi.listByInbox("HISTORY");
    const completed = history.filter((t) => t.status === "completed");
    return {
      completedWeek: completed.length,
      avgResponseMins: 0,
      ratingAvg: 0,
      onTimeRate: 0,
    };
  },

  async countActiveTasks(): Promise<number> {
    const active = await tasksApi.listByInbox("ACTIVE");
    return active.length;
  },
};
