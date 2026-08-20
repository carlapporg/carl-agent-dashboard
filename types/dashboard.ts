export type AgentAvailability = "online" | "busy" | "offline";

export type QueuePreviewItem = {
  id: string;
  number: number;
  title: string;
  summary: string;
  taskType: string;
  tier?: "standard" | "vip" | "family";
  priority: string;
  /** Server-authoritative SLA expiry (ISO). Client only renders countdown. */
  expiresAt: string;
  estimatedComplexity?: "low" | "medium" | "high";
};

export type ActiveTaskSummary = {
  id: string;
  number: number;
  title: string;
  customerLabel: string;
  stage: string;
  status: string;
  priority: string;
  urgency: "low" | "normal" | "high" | "urgent";
  unreadCount: number;
  pendingApprovalCount: number;
  actionRequired: boolean;
};

export type AgentAlertKind =
  | "payment_approved"
  | "payment_declined"
  | "sla_reply"
  | "escalated"
  | "missed_task";

export type AgentAlert = {
  id: string;
  kind: AgentAlertKind;
  title: string;
  body: string;
  taskId?: string;
  /** Workspace panel deep link target */
  panel?: "payment" | "chat" | "brief" | "log";
  createdAt: string;
  dismissed?: boolean;
  snoozedUntil?: string | null;
};

export type AgentQuickStats = {
  completedToday: number;
  completedWeek: number;
  avgResponseMins: number;
  ratingAvg: number | null;
};

export type ConversationSummary = {
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  taskStatus: string;
  lastMessage: string;
  lastActivityAt: string;
  unreadCount: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  taskId?: string;
  panel?: "payment" | "chat" | "brief" | "log";
};
