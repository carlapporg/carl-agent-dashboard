import type { Task, TaskStatus } from "@/types/task";

/**
 * Auto-assign workflow:
 * Assigned → Start → Steps → Complete
 * Stepper shows operational stages (non-linear highlight).
 */

export type WorkflowStageId =
  | "assigned"
  | "started"
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
    { id: "assigned", label: "Assigned", matches: ["queued", "assigned"] },
    {
      id: "started",
      label: "Started",
      matches: ["in_progress"],
    },
    {
      id: "waiting_customer",
      label: "Waiting Customer",
      matches: ["waiting_for_customer"],
    },
    {
      id: "waiting_payment",
      label: "Waiting Payment",
      matches: ["waiting_for_payment"],
    },
    {
      id: "in_progress",
      label: "In Progress",
      matches: ["in_progress"],
    },
    { id: "completed", label: "Completed", matches: ["completed"] },
  ];
}

/** Highlight only the current status stage (non-linear). */
export function currentStageId(task: Task): WorkflowStageId | null {
  if (task.status === "cancelled" || task.status === "failed") return null;
  if (task.status === "completed") return "completed";
  if (task.status === "waiting_for_payment") return "waiting_payment";
  if (task.status === "waiting_for_customer") return "waiting_customer";
  if (task.status === "in_progress") {
    return task.suggestedStepsDone.length === 0 ? "started" : "in_progress";
  }
  if (task.status === "queued" || task.status === "assigned") return "assigned";
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
  return (
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment"
  );
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
  if (task.status === "completed") return 100;
  if (!hasStartedWork(task)) return 0;
  return checklistProgressPercent(task);
}

export type PrimaryActionLabel = "Start task" | "Complete task";

export function primaryActionLabel(
  task: Task,
  paymentApproved: boolean,
): PrimaryActionLabel | null {
  if (task.status === "completed" || task.status === "cancelled") {
    return null;
  }

  if (!hasStartedWork(task)) {
    return "Start task";
  }

  if (!canCompleteTask(task, paymentApproved)) {
    return null;
  }

  return "Complete task";
}

export function canCompleteTask(
  task: Task,
  paymentApproved: boolean,
): boolean {
  if (!hasStartedWork(task)) return false;
  if (!allStepsComplete(task)) return false;
  if (taskRequiresPayment(task) && !paymentApproved) return false;
  return true;
}

export function completeGateReasons(
  task: Task,
  paymentApproved: boolean,
): string[] {
  const reasons: string[] = [];
  if (!allStepsComplete(task)) {
    reasons.push("All suggested steps must be marked done");
  }
  if (taskRequiresPayment(task) && !paymentApproved) {
    reasons.push("Payment must be approved (or reconciled) when required");
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
      return "Your task is waiting on your reply.";
    case "completed":
      return "Your task has been completed.";
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
