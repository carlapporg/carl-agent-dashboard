import {
  agentTaskSchema,
  agentTaskStatusSchema,
  rejectDeadlineIso,
  type AgentTask,
  type AgentTaskMessage,
  type AgentTaskStatus,
} from "@/types/agent";
import type { TimelineEvent } from "@/types/message";
import type { Task, TaskStatus } from "@/types/task";

export function uiStatusFromAgent(status: AgentTaskStatus): TaskStatus {
  switch (status) {
    case "ASSIGNED":
      return "assigned";
    case "IN_PROGRESS":
    case "WAITING_FOR_AGENT":
      return "in_progress";
    case "WAITING_FOR_USER":
      return "waiting_for_customer";
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
    case "CANCELLED":
    case "REJECTED":
      return "cancelled";
    default:
      return "assigned";
  }
}

export function agentStatusFromUi(
  status: TaskStatus,
): "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER" | null {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "waiting_for_customer":
      return "WAITING_FOR_USER";
    default:
      return null;
  }
}

function metadataSummary(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function displayNumber(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 90_000) + 10_000;
}

export function mapAgentTaskToUi(task: AgentTask): Task {
  const parsed = agentTaskStatusSchema.safeParse(task.status);
  const backendStatus = parsed.success ? parsed.data : "ASSIGNED";
  const summary =
    task.description?.trim() ||
    metadataSummary(task.metadata ?? undefined) ||
    task.title;
  const alias = task.client?.alias ?? "Client";
  const clientName = task.client?.firstName?.trim() || alias;

  return {
    id: task.id,
    number: displayNumber(task.id),
    title: task.title,
    request: summary,
    status: uiStatusFromAgent(backendStatus),
    priority: "normal",
    customerId: alias,
    customerName: clientName,
    parentId: null,
    childIds: [],
    assignedAgentId: task.assignedAgentId,
    aiBrief: {
      summary,
      missingInfo: [],
      suggestedActions: [],
    },
    notes: [],
    suggestedStepsDone: [],
    taskType: task.type,
    expiresAt:
      backendStatus === "ASSIGNED"
        ? rejectDeadlineIso(task.updatedAt)
        : undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    backendStatus,
    clientAlias: alias,
    metadata: task.metadata ?? null,
  };
}

export function mapSocketAssignedPayload(payload: unknown): Task | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const raw = "data" in record ? record.data : payload;
  const parsed = agentTaskSchema.safeParse(raw);
  if (!parsed.success) return null;
  return mapAgentTaskToUi(parsed.data);
}

export function mapAgentMessageToTimeline(
  message: AgentTaskMessage,
): TimelineEvent {
  const kind =
    message.sender === "AGENT"
      ? "agent_message"
      : message.sender === "USER"
        ? "customer_message"
        : "system";

  return {
    id: message.id,
    taskId: message.taskId,
    kind,
    body: message.content,
    createdAt: message.createdAt,
    visibleToCustomer: message.sender !== "SYSTEM",
  };
}
