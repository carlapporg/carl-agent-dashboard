import {
  isConfirmationConfirmed,
  isConfirmationPending,
  type TaskConfirmation,
} from "@/types/confirmation";
import {
  isReceiptAccepted,
  isReceiptPending,
  isReceiptRejected,
  type TaskReceipt,
} from "@/types/receipt";
import type { Task, TaskStatus } from "@/types/task";

/**
 * Auto-assign workflow:
 * Assigned → Start → Steps → Complete
 * Stepper shows operational stages (non-linear highlight).
 */

export type WorkflowStageId =
  | "offered"
  | "assigned"
  | "waiting_customer"
  | "waiting_payment"
  | "in_progress"
  | "completed";

export type WorkflowStage = {
  id: WorkflowStageId;
  label: string;
  /** Status(es) that light this stage as current */
  matches: TaskStatus[];
};

export function workflowStagesForTask(_task: Task): WorkflowStage[] {
  return [
    { id: "offered", label: "Offered", matches: ["queued"] },
    { id: "assigned", label: "Assigned", matches: ["assigned"] },
    {
      id: "in_progress",
      label: "In Progress",
      matches: ["in_progress"],
    },
    {
      id: "waiting_customer",
      label: "Waiting for Customer",
      matches: ["waiting_for_customer"],
    },
    {
      id: "waiting_payment",
      label: "Waiting for Payment",
      matches: ["waiting_for_payment"],
    },
    { id: "completed", label: "Completed", matches: ["completed"] },
  ];
}

/**
 * Status shown in the UI. Waiting for Customer only after a confirmation
 * is pending. After the customer approves, show Waiting for Payment.
 * Cancelled is shown as Failed.
 */
export function displayedTaskStatus(
  task: Task,
  confirmation?: TaskConfirmation | null,
): TaskStatus {
  if (task.backendStatus === "COMPLETED" || task.status === "completed") {
    return "completed";
  }
  if (
    task.backendStatus === "FAILED" ||
    task.backendStatus === "CANCELLED" ||
    task.status === "failed" ||
    task.status === "cancelled"
  ) {
    return "failed";
  }
  if (task.backendStatus === "REJECTED") return "cancelled";
  if (
    task.backendStatus === "OFFERED" ||
    task.backendStatus === "QUEUED" ||
    task.status === "queued"
  ) {
    return "queued";
  }
  if (task.backendStatus === "ASSIGNED" || task.status === "assigned") {
    return "assigned";
  }

  if (isConfirmationConfirmed(confirmation)) return "waiting_for_payment";
  if (isConfirmationPending(confirmation)) return "waiting_for_customer";
  if (confirmation?.status === "DECLINED" || confirmation?.status === "SUPERSEDED") {
    return "in_progress";
  }
  if (task.status === "waiting_for_payment") return "waiting_for_payment";
  if (task.status === "waiting_for_customer") return "waiting_for_customer";
  return "in_progress";
}

/** Highlight only the current status stage (non-linear). */
export function currentStageId(task: Task): WorkflowStageId | null {
  if (task.status === "cancelled" || task.status === "failed") return null;
  if (task.status === "completed") return "completed";
  if (task.status === "waiting_for_payment") return "waiting_payment";
  if (task.status === "waiting_for_customer") return "waiting_customer";
  if (task.status === "in_progress") return "in_progress";
  if (task.status === "queued") return "offered";
  if (task.status === "assigned") return "assigned";
  return "assigned";
}

export function taskRequiresPayment(task: Task): boolean {
  if (task.requiresPayment === true) return true;
  if (task.status === "waiting_for_payment") return true;
  const blob = [
    task.title,
    task.request,
    task.aiBrief?.summary ?? "",
    ...(task.aiBrief?.suggestedActions ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("payment") ||
    blob.includes("pay ") ||
    blob.includes("hotel") ||
    blob.includes("booking")
  );
}

export function hasStartedWork(task: Task): boolean {
  if (isClosedTask(task)) return false;
  const backend = task.backendStatus;
  return (
    backend === "IN_PROGRESS" ||
    backend === "WAITING_FOR_USER" ||
    backend === "WAITING_FOR_AGENT" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment"
  );
}

const CLOSED_BACKEND = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);

const CLOSED_UI = new Set(["completed", "failed", "cancelled"]);

/** Finished, failed, cancelled, or rejected — no more work. */
export function isClosedTask(task: Task): boolean {
  if (task.backendStatus && CLOSED_BACKEND.has(task.backendStatus)) return true;
  return CLOSED_UI.has(task.status);
}

export function isOfferOpen(task: Task): boolean {
  if (isClosedTask(task)) return false;
  return (
    task.backendStatus === "OFFERED" ||
    task.backendStatus === "QUEUED" ||
    task.status === "queued"
  );
}

export function canStartTask(task: Task): boolean {
  if (isClosedTask(task) || isOfferOpen(task)) return false;
  if (hasStartedWork(task)) return false;
  return (
    task.backendStatus === "ASSIGNED" ||
    task.status === "assigned"
  );
}

export function canSendConfirmationForTask(task: Task): boolean {
  if (isClosedTask(task) || isOfferOpen(task) || canStartTask(task)) {
    return false;
  }
  return (
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "WAITING_FOR_USER" ||
    task.backendStatus === "WAITING_FOR_AGENT" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment"
  );
}

export function canUpdateAgentStatus(task: Task): boolean {
  return hasStartedWork(task) && !isClosedTask(task);
}

export function isFailedOrCancelled(task: Task): boolean {
  if (task.backendStatus === "REJECTED") return false;
  return (
    task.backendStatus === "FAILED" ||
    task.backendStatus === "CANCELLED" ||
    task.status === "failed" ||
    task.status === "cancelled"
  );
}

export function canMessageClient(task: Task): boolean {
  if (isOfferOpen(task)) return false;
  if (task.backendStatus === "COMPLETED" || task.status === "completed") {
    return false;
  }
  if (task.backendStatus === "REJECTED") return false;
  return true;
}

export function messageClientHint(task: Task): string | undefined {
  if (isOfferOpen(task)) {
    return "Accept the offer before messaging the client.";
  }
  if (task.backendStatus === "COMPLETED" || task.status === "completed") {
    return "This task is completed, so messages cannot be sent.";
  }
  if (task.backendStatus === "REJECTED") {
    return "This offer was rejected, so messages cannot be sent.";
  }
  if (
    task.backendStatus === "FAILED" ||
    task.backendStatus === "CANCELLED" ||
    task.status === "failed" ||
    task.status === "cancelled"
  ) {
    return "Tell the client why this task failed.";
  }
  return undefined;
}

export function closedTaskMessage(task: Task): string {
  if (
    task.backendStatus === "FAILED" ||
    task.backendStatus === "CANCELLED" ||
    task.status === "failed" ||
    task.status === "cancelled"
  ) {
    return "This task failed. You cannot start it, send confirmation, or change status. You can still message the client to explain why.";
  }
  if (task.backendStatus === "REJECTED") {
    return "This offer was rejected. No further actions are available.";
  }
  return "This task is completed. It is read-only.";
}

/** @deprecated Prefer currentStageId — kept for progress bar. */
export function currentWorkflowIndex(
  task: Task,
  stages: WorkflowStage[],
): number {
  const id = currentStageId(task);
  if (!id) return -1;
  const idx = stages.findIndex((s) => s.id === id);
  return idx;
}

export function checklistSteps(task: Task): string[] {
  const fromBrief = task.aiBrief?.suggestedActions?.filter(Boolean) ?? [];
  if (fromBrief.length > 0) return fromBrief;

  const missing = task.aiBrief?.missingInfo?.filter(Boolean) ?? [];
  if (missing.length > 0) {
    return missing.map((item) => `Confirm: ${item}`);
  }

  return [
    "Review task details",
    "Complete the request",
    "Confirm with client",
  ];
}

export function allStepsComplete(task: Task): boolean {
  const steps = checklistSteps(task);
  if (steps.length === 0) return true;
  return steps.every((step) => task.suggestedStepsDone.includes(step));
}

export function checklistProgressPercent(task: Task): number {
  const steps = checklistSteps(task);
  if (steps.length === 0) return 0;
  const done = steps.filter((s) =>
    task.suggestedStepsDone.includes(s),
  ).length;
  return Math.round((done / steps.length) * 100);
}

/** 0% until Start; then checklist %; 100% when completed. */
export function overallProgressPercent(task: Task): number {
  if (task.backendStatus === "COMPLETED" || task.status === "completed") {
    return 100;
  }
  if (isClosedTask(task) || !hasStartedWork(task)) return 0;
  return checklistProgressPercent(task);
}

export type PrimaryActionLabel = "Start task" | "Complete task" | "Complete booking";

export function primaryActionLabel(
  task: Task,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): PrimaryActionLabel | null {
  if (isClosedTask(task) || isOfferOpen(task)) return null;
  if (canStartTask(task)) return "Start task";
  if (!canCompleteTask(task, confirmation, receipt)) return null;
  return "Complete booking";
}

export function canCompleteTask(
  task: Task,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): boolean {
  if (isClosedTask(task) || !hasStartedWork(task)) return false;
  if (!isConfirmationConfirmed(confirmation)) return false;
  if (!isReceiptAccepted(receipt)) return false;
  return true;
}

export function completeRequiresPayment(task: Task): boolean {
  return task.requiresPayment === true;
}

export function completeGateReasons(
  task: Task,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): string[] {
  if (isClosedTask(task)) return [];
  const reasons: string[] = [];
  if (!isConfirmationConfirmed(confirmation)) {
    if (confirmation?.status === "PENDING") {
      reasons.push("Wait for the client to confirm the task details");
    } else if (confirmation?.status === "DECLINED") {
      reasons.push("Client declined the details. Send a new confirmation");
    } else {
      reasons.push("Send task details and wait for confirmation");
    }
  }
  if (!isReceiptAccepted(receipt)) {
    if (isReceiptPending(receipt)) {
      reasons.push("Wait for the user to review the receipt");
    } else if (isReceiptRejected(receipt)) {
      reasons.push("User rejected the receipt. Upload a new one");
    } else if (isConfirmationConfirmed(confirmation)) {
      reasons.push("Upload a receipt and wait for the user to accept it");
    }
  }
  return reasons;
}

export function clientMessageForStatus(status: TaskStatus): string {
  switch (status) {
    case "assigned":
      return "An agent has been assigned to your task.";
    case "in_progress":
      return "Your task has been started.";
    case "waiting_for_payment":
      return "Your task is awaiting payment approval.";
    case "waiting_for_customer":
      return "Please review the details and approve or reject them.";
    case "completed":
      return "Your task has been completed.";
    case "failed":
    case "cancelled":
      return "This task could not be completed.";
    default:
      return `Your task status is now ${status.replaceAll("_", " ")}.`;
  }
}

export const PAYMENT_REQUEST_CLIENT_MESSAGE =
  "The agent has requested payment approval before continuing this task.";

export const CHAT_TEMPLATES = [
  "Thanks — I’m on this now.",
  "Could you confirm the details so I can continue?",
  "Payment request sent. Please approve when ready.",
  "All set on my side. Anything else you need?",
] as const;
