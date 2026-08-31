export type AgentAvailability = "available" | "busy" | "offline";

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
  | "task_assigned"
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

export type NotificationKind =
  | "task_offered"
  | "task_assigned"
  | "client_message"
  | "payment_approved"
  | "payment_declined"
  | "payment_expired"
  | "task_cancelled"
  | "waiting_for_agent"
  | "missed_task"
  | "confirmation_confirmed"
  | "confirmation_declined"
  | "receipt_accepted"
  | "receipt_rejected";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  taskId?: string;
  panel?: "payment" | "chat" | "brief" | "log" | "receipt";
};

export type NotificationPrefs = {
  taskAssigned: boolean;
  paymentResult: boolean;
  slaWarning: boolean;
  customerReply: boolean;
  desktop: boolean;
  sound: boolean;
};
