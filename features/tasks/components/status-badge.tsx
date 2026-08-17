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
  return status.replaceAll("_", " ");
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={statusBadgeVariant(status)}>{formatStatus(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={priorityBadgeVariant(priority)}>{priority}</Badge>
  );
}
