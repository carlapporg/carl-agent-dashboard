import type { TaskPriority, TaskStatus } from "@/types/task";
import { Badge } from "@/components/ui/badge";

export function statusBadgeVariant(
  status: TaskStatus,
): "default" | "accent" | "warning" | "danger" | "success" | "muted" {
  switch (status) {
    case "queued":
      return "muted";
    case "assigned":
    case "in_progress":
      return "accent";
    case "waiting_for_customer":
    case "waiting_for_payment":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

export function priorityBadgeVariant(
  priority: TaskPriority,
): "default" | "accent" | "warning" | "danger" | "muted" {
  switch (priority) {
    case "urgent":
      return "danger";
    case "high":
      return "warning";
    case "normal":
      return "accent";
    default:
      return "muted";
  }
}

export function formatStatus(status: TaskStatus): string {
  switch (status) {
    case "queued":
      return "Offered";
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "waiting_for_customer":
      return "Waiting for Customer";
    case "waiting_for_payment":
      return "Waiting for Payment";
    case "completed":
      return "Completed";
    case "failed":
    case "cancelled":
      return "Failed";
  }
}

const STATUS_DOT: Record<TaskStatus, string> = {
  queued: "bg-muted-dim",
  assigned: "bg-sky-500",
  in_progress: "bg-accent",
  waiting_for_customer: "bg-amber-500",
  waiting_for_payment: "bg-orange-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
  failed: "bg-red-500",
};

export function StatusBadge({
  status,
  withDot = false,
}: {
  status: TaskStatus;
  withDot?: boolean;
}) {
  return (
    <Badge variant={statusBadgeVariant(status)}>
      {withDot ? (
        <span
          className={`mr-1.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
          aria-hidden
        />
      ) : null}
      {formatStatus(status)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={priorityBadgeVariant(priority)}>{priority}</Badge>;
}
