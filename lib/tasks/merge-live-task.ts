import type { AgentTaskStatus } from "@/types/agent";
import {
  isMarkedRejected,
  isPendingReject,
} from "@/features/ops/rejected-offers";
import { isRejectingOrRejected } from "@/features/ops/auto-accept-offer";
import type { Task } from "@/types/task";

const RANK: Record<string, number> = {
  QUEUED: 1,
  OFFERED: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  WAITING_FOR_USER: 3,
  WAITING_FOR_AGENT: 3,
  COMPLETED: 4,
  FAILED: 4,
  CANCELLED: 4,
  REJECTED: 4,
};

function rank(task: Task): number {
  const backend = task.backendStatus ?? "";
  if (backend in RANK) return RANK[backend];
  if (task.status === "in_progress" || task.status === "waiting_for_customer" || task.status === "waiting_for_payment") {
    return 3;
  }
  if (task.status === "assigned") return 2;
  if (task.status === "queued") return 1;
  return 0;
}

function isSparse(task: Task): boolean {
  return (
    task.number === 0 ||
    task.title === "Task" ||
    task.title === "New task offered" ||
    (task.customerName === "Client" && !task.request)
  );
}

function isTerminalStatus(task: Task): boolean {
  const backend = task.backendStatus ?? "";
  return (
    backend === "FAILED" ||
    backend === "CANCELLED" ||
    backend === "REJECTED" ||
    backend === "COMPLETED" ||
    task.status === "failed" ||
    task.status === "cancelled" ||
    task.status === "completed"
  );
}

export function isKeptAfterMiss(task: Task): boolean {
  return (
    task.backendStatus === "ASSIGNED" ||
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "WAITING_FOR_USER" ||
    task.backendStatus === "WAITING_FOR_AGENT"
  );
}

/** Offer-miss FAIL payloads are thin. Do not close accepted/started work. */
export function shouldIgnoreClosedSocketUpdate(
  current: Task | undefined,
  incoming: Task | null | undefined,
  incomingStatus?: AgentTaskStatus,
): boolean {
  if (!current || !isKeptAfterMiss(current)) return false;
  if (incoming && isKeptAfterMiss(incoming) && !isSparse(incoming)) return false;
  const status = incoming?.backendStatus ?? incomingStatus;
  return status === "FAILED" || status === "REJECTED";
}

function laterDeadline(left?: string, right?: string): string | undefined {
  const leftMs = left ? new Date(left).getTime() : Number.NaN;
  const rightMs = right ? new Date(right).getTime() : Number.NaN;
  const now = Date.now();
  const leftLive = Number.isFinite(leftMs) && leftMs > now;
  const rightLive = Number.isFinite(rightMs) && rightMs > now;
  if (leftLive && rightLive) return leftMs >= rightMs ? left : right;
  if (rightLive) return right;
  if (leftLive) return left;
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs >= rightMs ? left : right;
  }
  return left ?? right;
}

function withFreshDeadline(merged: Task, base: Task, incoming: Task): Task {
  if (rank(merged) >= 2) {
    return { ...merged, expiresAt: undefined };
  }
  return {
    ...merged,
    expiresAt: laterDeadline(base.expiresAt, incoming.expiresAt),
  };
}

/** Keep the more advanced, newer status so a stale socket cannot rewind work. */
export function mergeByProgress(base: Task, incoming: Task): Task {
  const incomingAt = new Date(incoming.updatedAt).getTime();
  const baseAt = new Date(base.updatedAt).getTime();
  if (
    Number.isFinite(incomingAt) &&
    Number.isFinite(baseAt) &&
    incomingAt < baseAt
  ) {
    return withFreshDeadline(base, base, incoming);
  }

  // A thin socket payload (offer missed, status-only) must not close real work.
  if (
    isSparse(incoming) &&
    !isSparse(base) &&
    isKeptAfterMiss(base) &&
    isTerminalStatus(incoming)
  ) {
    return withFreshDeadline(base, base, incoming);
  }

  if (isSparse(incoming) && !isSparse(base)) {
    const incomingRank = rank(incoming);
    const baseRank = rank(base);
    if (incomingRank <= baseRank) {
      return withFreshDeadline(base, base, incoming);
    }
    return withFreshDeadline(
      {
        ...base,
        backendStatus: incoming.backendStatus,
        status: incoming.status,
        updatedAt: incoming.updatedAt || base.updatedAt,
      },
      base,
      incoming,
    );
  }

  const incomingRank = rank(incoming);
  const baseRank = rank(base);
  if (incomingRank > baseRank) {
    return withFreshDeadline(
      {
        ...incoming,
        title: isSparse(incoming) ? base.title : incoming.title,
        customerName: isSparse(incoming) ? base.customerName : incoming.customerName,
        request: incoming.request || base.request,
        number: incoming.number || base.number,
      },
      base,
      incoming,
    );
  }
  if (incomingRank < baseRank) {
    return withFreshDeadline(
      {
        ...incoming,
        ...base,
        backendStatus: base.backendStatus,
        status: base.status,
      },
      base,
      incoming,
    );
  }
  if (incomingAt >= baseAt) {
    if (isSparse(incoming)) return withFreshDeadline(base, base, incoming);
    return withFreshDeadline({ ...base, ...incoming }, base, incoming);
  }
  return withFreshDeadline(base, base, incoming);
}

export function pinWhileRejecting(task: Task): Task {
  if (!isRejectingOrRejected(task.id) && !isPendingReject(task.id)) return task;
  if (task.backendStatus === "OFFERED" || task.status === "queued") return task;
  return {
    ...task,
    backendStatus: "OFFERED",
    status: "queued",
  };
}

function keepConfirmationWait(base: Task, next: Task): Task {
  if (
    base.status === "waiting_for_customer" &&
    next.backendStatus === "WAITING_FOR_USER" &&
    next.status === "in_progress"
  ) {
    return { ...next, status: "waiting_for_customer" };
  }
  return next;
}

function keepPaymentWait(base: Task, next: Task): Task {
  if (
    base.status === "waiting_for_payment" &&
    next.status === "waiting_for_customer" &&
    (next.backendStatus === "WAITING_FOR_USER" ||
      next.backendStatus === "IN_PROGRESS")
  ) {
    return { ...next, status: "waiting_for_payment" };
  }
  return next;
}

export function keepStatusOverlays(base: Task, next: Task): Task {
  return keepPaymentWait(base, keepConfirmationWait(base, next));
}

export function mergeTaskLists(
  seed: Task[],
  live: Task[],
  offer?: Task | null,
): Task[] {
  const byId = new Map<string, Task>();
  for (const task of seed) {
    if (isMarkedRejected(task.id) && !isPendingReject(task.id)) continue;
    byId.set(task.id, pinWhileRejecting(task));
  }
  for (const task of live) {
    if (isMarkedRejected(task.id) && !isPendingReject(task.id)) {
      byId.delete(task.id);
      continue;
    }
    const existing = byId.get(task.id);
    const next = existing
      ? keepStatusOverlays(existing, mergeByProgress(existing, task))
      : task;
    byId.set(task.id, pinWhileRejecting(next));
  }
  if (offer && !(isMarkedRejected(offer.id) && !isPendingReject(offer.id))) {
    const existing = byId.get(offer.id);
    const next = existing
      ? keepStatusOverlays(existing, mergeByProgress(existing, offer))
      : offer;
    byId.set(offer.id, pinWhileRejecting(next));
  }
  return [...byId.values()].filter((task) => task.backendStatus !== "REJECTED");
}

export function liveStatusPatch(
  backendStatus: AgentTaskStatus,
  uiStatus: Task["status"],
): Partial<Task> {
  const pastOffer = (RANK[backendStatus] ?? 0) >= 2;
  return {
    backendStatus,
    status: uiStatus,
    updatedAt: new Date().toISOString(),
    ...(pastOffer ? { expiresAt: undefined } : {}),
  };
}
