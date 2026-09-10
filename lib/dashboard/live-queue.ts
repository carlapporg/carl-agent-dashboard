import type { MonthFilterValue } from "@/features/dashboard/components/month-filter-pill";
import {
  isTimestampInDashboardRange,
  type DashboardRange,
} from "@/lib/dashboard/range";
import type { Task } from "@/types/task";

/** Day filter aligned with dashboard range labels + overview API. */
export type LiveDayFilter = "today" | "week" | "month" | "all";

/** Open statuses shown in Live Task Queue (active work). */
export function isLiveQueueTask(task: Task): boolean {
  return (
    task.backendStatus === "OFFERED" ||
    task.backendStatus === "ASSIGNED" ||
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "WAITING_FOR_USER" ||
    task.backendStatus === "WAITING_FOR_AGENT" ||
    task.status === "queued" ||
    task.status === "assigned" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment"
  );
}

export function isCompletedQueueTask(task: Task): boolean {
  return (
    task.backendStatus === "COMPLETED" || task.status === "completed"
  );
}

/** Open + completed rows for the dashboard queue table. */
export function isQueueTableTask(task: Task): boolean {
  return isLiveQueueTask(task) || isCompletedQueueTask(task);
}

export function toLiveDayFilter(label: MonthFilterValue): LiveDayFilter {
  if (label === "Today") return "today";
  if (label === "This week") return "week";
  if (label === "This month") return "month";
  return "all";
}

function dayFilterToRange(filter: LiveDayFilter): DashboardRange | null {
  if (filter === "today") return "today";
  if (filter === "week") return "this_week";
  if (filter === "month") return "this_month";
  return null;
}

/**
 * Calendar windows (same as overview API):
 * - Today → calendar day
 * - This week → Mon–Sun (local)
 * - This month → 1st → now
 * - All time → no cut
 *
 * Open tasks: `updatedAt` or `createdAt`.
 * Completed: `completedAt` (fallback `updatedAt`).
 */
export function matchesLiveDayFilter(
  task: Task,
  filter: LiveDayFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  const range = dayFilterToRange(filter);
  if (!range) return true;

  if (isCompletedQueueTask(task)) {
    return isTimestampInDashboardRange(
      task.completedAt ?? task.updatedAt,
      range,
      now,
    );
  }

  return (
    isTimestampInDashboardRange(task.updatedAt, range, now) ||
    isTimestampInDashboardRange(task.createdAt, range, now)
  );
}

/** Open-only rows — metric cards. */
export function filterLiveQueueTasks(
  tasks: Task[],
  dayFilter: LiveDayFilter = "all",
  now = new Date(),
): Task[] {
  return tasks
    .filter((t) => !t.parentId)
    .filter(isLiveQueueTask)
    .filter((t) => matchesLiveDayFilter(t, dayFilter, now))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

/** Open + completed rows — Live Task Queue table. */
export function filterQueueTableTasks(
  tasks: Task[],
  dayFilter: LiveDayFilter = "all",
  now = new Date(),
): Task[] {
  return tasks
    .filter((t) => !t.parentId)
    .filter(isQueueTableTask)
    .filter((t) => matchesLiveDayFilter(t, dayFilter, now))
    .sort((a, b) => {
      const aAt = isCompletedQueueTask(a)
        ? a.completedAt ?? a.updatedAt
        : a.updatedAt;
      const bAt = isCompletedQueueTask(b)
        ? b.completedAt ?? b.updatedAt
        : b.updatedAt;
      return new Date(bAt).getTime() - new Date(aAt).getTime();
    });
}

export type LiveQueueBuckets = {
  /** OFFERED / queued — Needs Attention */
  offered: number;
  /** ASSIGNED / IN_PROGRESS / WAITING_FOR_AGENT — Task in Progress */
  inProgress: number;
  /** Waiting on customer / payment */
  waitingCustomer: number;
  /** Progress “waiting” ring = offered + waitingCustomer */
  waiting: number;
  /** Open live count (excludes completed) */
  liveCount: number;
};

/**
 * Split open rows only (ignore completed if present).
 * `inProgress + waiting === liveCount`.
 */
export function bucketLiveQueueTasks(tasks: Task[]): LiveQueueBuckets {
  let offered = 0;
  let inProgress = 0;
  let waitingCustomer = 0;

  for (const task of tasks) {
    if (isCompletedQueueTask(task)) continue;
    if (!isLiveQueueTask(task)) continue;

    const backend = task.backendStatus;
    if (
      backend === "WAITING_FOR_USER" ||
      task.status === "waiting_for_customer" ||
      task.status === "waiting_for_payment"
    ) {
      waitingCustomer += 1;
      continue;
    }
    if (backend === "OFFERED" || task.status === "queued") {
      offered += 1;
      continue;
    }
    inProgress += 1;
  }

  const waiting = offered + waitingCustomer;
  return {
    offered,
    inProgress,
    waitingCustomer,
    waiting,
    liveCount: inProgress + waiting,
  };
}
