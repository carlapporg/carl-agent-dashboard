import {
  agentTaskSchema,
  agentTaskStatusSchema,
  rejectDeadlineIso,
  REJECT_WINDOW_MS,
  type AgentTask,
  type AgentTaskMessage,
  type AgentTaskStatus,
} from "@/types/agent";
import type { ChatMediaKind, TimelineEvent } from "@/types/message";
import type { Task, TaskStatus } from "@/types/task";
import {
  parseConfirmationFormSchema,
  parseConfirmationPrefill,
} from "@/types/confirmation";

export function uiStatusFromAgent(status: AgentTaskStatus): TaskStatus {
  switch (status) {
    case "OFFERED":
    case "QUEUED":
      return "queued";
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
    case "CANCELLED":
      return "failed";
    case "REJECTED":
      return "cancelled";
    default:
      return "assigned";
  }
}

export function agentStatusFromUi(
  status: TaskStatus,
): "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER" | null {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "waiting_for_customer":
      return "WAITING_FOR_USER";
    case "in_progress":
      return "IN_PROGRESS";
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

function inferBackendStatus(task: AgentTask): AgentTaskStatus {
  const parsed = agentTaskStatusSchema.safeParse(task.status);
  if (parsed.success) return parsed.data;
  if (task.assignedAgentId) return "ASSIGNED";
  const rejectUntilMs = task.rejectUntil
    ? new Date(task.rejectUntil).getTime()
    : Number.NaN;
  const rejectLive =
    Number.isFinite(rejectUntilMs) && rejectUntilMs > Date.now();
  if (task.canReject === true && rejectLive) return "OFFERED";
  if (rejectLive) return "OFFERED";
  return "ASSIGNED";
}

function offerExpiresAt(task: AgentTask, status: AgentTaskStatus): string | undefined {
  if (status !== "OFFERED" && status !== "QUEUED") return undefined;
  if (task.rejectUntil) {
    const until = new Date(task.rejectUntil).getTime();
    if (Number.isFinite(until)) return new Date(until).toISOString();
  }
  const base = task.updatedAt || task.createdAt;
  if (base && !Number.isNaN(new Date(base).getTime())) {
    return rejectDeadlineIso(base);
  }
  return new Date(Date.now() + REJECT_WINDOW_MS).toISOString();
}

/** Prefer top-level membership only. Never use metadata membership fields. */
function resolveMembership(task: AgentTask): Task["membership"] {
  const top = task.membership;
  if (!top || typeof top !== "object") return null;
  const brand = typeof top.brand === "string" ? top.brand.trim() : "";
  const membershipId =
    typeof top.membershipId === "string" ? top.membershipId.trim() : "";
  if (brand && membershipId) return { brand, membershipId };
  return null;
}

function resolveTaskType(task: AgentTask): string {
  const fromTaskType =
    typeof task.taskType === "string" ? task.taskType.trim() : "";
  if (fromTaskType) return fromTaskType;
  const fromType = typeof task.type === "string" ? task.type.trim() : "";
  return fromType || "TASK";
}

function resolveConfirmationSchema(
  task: AgentTask,
): Task["confirmationSchema"] {
  return parseConfirmationFormSchema(task.confirmationSchema);
}

function resolveConfirmationPrefill(
  task: AgentTask,
): Task["confirmationPrefill"] {
  const prefill = parseConfirmationPrefill(task.confirmationPrefill);
  return Object.keys(prefill).length > 0 ? prefill : undefined;
}

export function mapAgentTaskToUi(task: AgentTask): Task {
  const backendStatus = inferBackendStatus(task);
  const summary = task.description?.trim() ?? "";
  const alias = task.client?.alias ?? "Client";
  const clientName = task.client?.firstName?.trim() || alias;
  const created = new Date(task.createdAt);
  const stamp = Number.isNaN(created.getTime())
    ? "000000"
    : created.toISOString().slice(2, 10).replaceAll("-", "");
  const taskType = resolveTaskType(task);
  const typeKey = taskType.toUpperCase();
  const prefix = typeKey.replace(/[^A-Z]/g, "").slice(0, 3) || "TSK";
  const code = `${prefix}-${stamp}-${task.id.replaceAll("-", "").slice(-4).toUpperCase()}`;
  const prefill = resolveConfirmationPrefill(task);

  return {
    id: task.id,
    number: displayNumber(task.id),
    code,
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
    taskType,
    expiresAt: offerExpiresAt(task, backendStatus),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    backendStatus,
    clientAlias: alias,
    metadata:
      task.metadata &&
      typeof task.metadata === "object" &&
      !Array.isArray(task.metadata)
        ? (task.metadata as Record<string, unknown>)
        : null,
    membership: resolveMembership(task),
    confirmationSchema: resolveConfirmationSchema(task),
    confirmationPrefill: prefill,
    canReject: task.canReject,
    rejectUntil:
      backendStatus === "OFFERED" || backendStatus === "QUEUED"
        ? task.rejectUntil
        : null,
  };
}

export function mapSocketAssignedPayload(payload: unknown): Task | null {
  const parsed = agentTaskSchema.safeParse(payload);
  if (parsed.success) return mapAgentTaskToUi(parsed.data);
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const nested =
    record.data ?? record.task ?? record.payload ?? record.offer;
  const retry = agentTaskSchema.safeParse(nested);
  return retry.success ? mapAgentTaskToUi(retry.data) : null;
}

function captionFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  return typeof record.caption === "string" ? record.caption : "";
}

export function mediaKindFromMessage(message: AgentTaskMessage): ChatMediaKind {
  const type = (message.messageType ?? "").toUpperCase();
  if (type.includes("VOICE") || type === "AUDIO") return "voice";
  if (type.includes("IMAGE") || type === "PHOTO" || type === "PICTURE") {
    return "image";
  }
  if (message.mimeType?.startsWith("audio/")) return "voice";
  if (message.mimeType?.startsWith("image/")) return "image";
  if (message.audioUrl) return "voice";
  if (message.imageUrl) return "image";
  const meta = message.metadata;
  if (meta && typeof meta === "object") {
    const record = meta as Record<string, unknown>;
    const metaType = String(record.messageType ?? record.type ?? "").toUpperCase();
    if (metaType.includes("VOICE") || metaType === "AUDIO") return "voice";
    if (metaType.includes("IMAGE")) return "image";
    if (typeof record.audioUrl === "string" && record.audioUrl) return "voice";
    if (typeof record.imageUrl === "string" && record.imageUrl) return "image";
  }
  if (typeof message.durationMs === "number" && message.durationMs > 0) {
    return "voice";
  }
  return "text";
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
  const mediaKind = mediaKindFromMessage(message);

  return {
    id: message.id,
    taskId: message.taskId,
    kind,
    body:
      message.content ||
      message.caption ||
      captionFromMetadata(message.metadata) ||
      "",
    createdAt: message.createdAt,
    visibleToCustomer: message.sender !== "SYSTEM",
    mediaKind,
    durationMs: message.durationMs,
    mimeType: message.mimeType,
  };
}
