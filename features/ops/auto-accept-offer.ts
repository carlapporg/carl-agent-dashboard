"use client";

import { useSyncExternalStore } from "react";
import {
  acceptTaskAction,
  getOfferLiveStateAction,
  rejectTaskAction,
  type TaskActionResult,
} from "@/features/tasks/actions/task-actions";
import { USER_MESSAGES } from "@/lib/api/public-messages";

/**
 * Auto-accept only after the full 30s window (the 31st second).
 * Do not fire early while the agent can still reject.
 */
export const EARLY_ACCEPT_MS = 0;

type OfferFlight = "none" | "accept" | "reject";
type OfferSettled = "none" | "accepted" | "rejected";
type OfferClaim = "none" | "accept" | "reject";

export type OfferDecision = {
  flight: OfferFlight;
  settled: OfferSettled;
  rejectUiOpen: boolean;
  windowExpired: boolean;
  /** Remaining ms frozen when the agent acts — stops the visible countdown. */
  frozenRemainingMs: number | null;
};

const EMPTY: OfferDecision = {
  flight: "none",
  settled: "none",
  rejectUiOpen: false,
  windowExpired: false,
  frozenRemainingMs: null,
};

const states = new Map<string, OfferDecision>();
const claims = new Map<string, OfferClaim>();
const acceptPosts = new Map<string, Promise<TaskActionResult>>();
const rejectPosts = new Map<string, Promise<TaskActionResult>>();
const autoAcceptGen = new Map<string, number>();
const taskListeners = new Map<string, Set<() => void>>();

function emit(taskId: string) {
  taskListeners.get(taskId)?.forEach((listener) => listener());
}

function read(taskId: string): OfferDecision {
  return states.get(taskId) ?? EMPTY;
}

function write(taskId: string, patch: Partial<OfferDecision>) {
  if (!taskId) return;
  const next = { ...EMPTY, ...(states.get(taskId) ?? EMPTY), ...patch };
  states.set(taskId, next);
  emit(taskId);
}

function subscribeTask(taskId: string, listener: () => void) {
  let bucket = taskListeners.get(taskId);
  if (!bucket) {
    bucket = new Set();
    taskListeners.set(taskId, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket!.delete(listener);
    if (bucket!.size === 0) taskListeners.delete(taskId);
  };
}

function bumpAutoAcceptGen(taskId: string) {
  autoAcceptGen.set(taskId, (autoAcceptGen.get(taskId) ?? 0) + 1);
}

export function getOfferTimerGeneration(taskId: string): number {
  return autoAcceptGen.get(taskId) ?? 0;
}

function claimOf(taskId: string): OfferClaim {
  return claims.get(taskId) ?? "none";
}

export function useOfferDecision(taskId?: string): OfferDecision {
  return useSyncExternalStore(
    (listener) => (taskId ? subscribeTask(taskId, listener) : () => {}),
    () => (taskId ? read(taskId) : EMPTY),
    () => EMPTY,
  );
}

function freezeOfferTimer(taskId: string, expiresAt: string) {
  const end = new Date(expiresAt).getTime();
  const remaining = Number.isFinite(end) ? Math.max(0, end - Date.now()) : 0;
  write(taskId, { frozenRemainingMs: remaining });
}

/** Timer is paused while accept/reject is in flight or the reject dialog is open. */
export function isOfferTimerPaused(taskId: string): boolean {
  const state = read(taskId);
  if (state.settled !== "none") return true;
  if (state.flight !== "none") return true;
  if (state.rejectUiOpen) return true;
  return false;
}

export function hasOpenRejectUi(taskId: string): boolean {
  return read(taskId).rejectUiOpen;
}

export function isOfferInRejectFlow(taskId: string): boolean {
  return hasOpenRejectUi(taskId) || isRejectingOrRejected(taskId);
}

export function canAutoAcceptOffer(taskId: string): boolean {
  const state = read(taskId);
  return (
    state.settled === "none" &&
    state.flight === "none" &&
    !state.rejectUiOpen &&
    claimOf(taskId) !== "reject"
  );
}

export function isOfferAcceptLocked(taskId: string): boolean {
  const state = read(taskId);
  return (
    state.flight !== "none" ||
    state.settled !== "none" ||
    claimOf(taskId) === "reject"
  );
}

export function offerWasAccepted(taskId: string): boolean {
  return read(taskId).settled === "accepted";
}

export function isRejectingOrRejected(taskId: string): boolean {
  const state = read(taskId);
  return (
    state.flight === "reject" ||
    state.settled === "rejected" ||
    claimOf(taskId) === "reject"
  );
}

export function canShowRejectUi(taskId: string): boolean {
  const state = read(taskId);
  if (state.settled !== "none") return false;
  if (state.flight === "accept" || claimOf(taskId) === "accept") return false;
  if (state.windowExpired && state.flight !== "reject" && claimOf(taskId) !== "reject") {
    return false;
  }
  return true;
}

export function cancelInFlightAutoAccept(taskId: string) {
  if (!taskId) return;
  bumpAutoAcceptGen(taskId);
}

export function openRejectOfferUi(taskId: string, expiresAt?: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.settled !== "none" || state.windowExpired) return;
  if (claimOf(taskId) === "accept") return;
  if (expiresAt) freezeOfferTimer(taskId, expiresAt);
  write(taskId, { rejectUiOpen: true });
}

export function closeRejectOfferUi(taskId: string, expiresAt?: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (!state.rejectUiOpen) return;
  if (state.flight === "reject" || claimOf(taskId) === "reject") return;
  const windowStillOpen =
    expiresAt != null &&
    Number.isFinite(new Date(expiresAt).getTime()) &&
    Date.now() < new Date(expiresAt).getTime();
  write(taskId, {
    rejectUiOpen: false,
    frozenRemainingMs: windowStillOpen ? null : state.frozenRemainingMs,
  });
}

export function expireRejectWindow(taskId: string) {
  if (!taskId) return;
  if (isOfferTimerPaused(taskId)) return;
  const state = read(taskId);
  if (state.settled !== "none") return;
  const rejecting = state.flight === "reject" || claimOf(taskId) === "reject";
  write(taskId, {
    windowExpired: true,
    rejectUiOpen: rejecting ? state.rejectUiOpen : false,
  });
}

export function beginAcceptOffer(taskId: string, expiresAt?: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.settled === "accepted") return true;
  if (state.settled === "rejected") return false;
  if (state.flight === "reject" || claimOf(taskId) === "reject") return false;
  if (state.flight === "accept" || claimOf(taskId) === "accept") return false;
  claims.set(taskId, "accept");
  bumpAutoAcceptGen(taskId);
  if (expiresAt) freezeOfferTimer(taskId, expiresAt);
  write(taskId, {
    flight: "accept",
    rejectUiOpen: false,
  });
  return true;
}

/**
 * Claim reject immediately so auto-accept cannot start.
 * Do not hide the task until Nest confirms.
 */
export function beginRejectOffer(taskId: string, expiresAt?: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.settled === "rejected" || claimOf(taskId) === "reject") return true;
  if (state.settled === "accepted") return false;
  if (state.flight === "accept" || claimOf(taskId) === "accept") return false;
  claims.set(taskId, "reject");
  bumpAutoAcceptGen(taskId);
  if (expiresAt) freezeOfferTimer(taskId, expiresAt);
  write(taskId, {
    flight: "reject",
    rejectUiOpen: true,
    settled: "none",
  });
  return true;
}

async function reconcileFromBackend(
  taskId: string,
  fallback: TaskActionResult,
): Promise<TaskActionResult> {
  try {
    const live = await getOfferLiveStateAction(taskId);
    if (live === "rejected") {
      claims.set(taskId, "none");
      write(taskId, {
        flight: "none",
        settled: "rejected",
        rejectUiOpen: false,
      });
      return { ok: true };
    }
    if (live === "accepted") {
      claims.set(taskId, "none");
      write(taskId, {
        flight: "none",
        settled: "accepted",
        rejectUiOpen: false,
        windowExpired: true,
      });
      return {
        ok: false,
        message: USER_MESSAGES.offerAlreadyAccepted,
        reason: "already_accepted",
      };
    }
    if (live === "offered") {
      claims.set(taskId, "none");
      write(taskId, {
        flight: "none",
        rejectUiOpen: false,
        windowExpired: true,
      });
      return {
        ok: false,
        message: USER_MESSAGES.rejectWindowEnded,
        reason: "expired",
      };
    }
    claims.set(taskId, "none");
    write(taskId, { flight: "none", rejectUiOpen: false });
    return {
      ok: false,
      message: USER_MESSAGES.offerGone,
      gone: true,
      reason: "gone",
    };
  } catch {
    claims.set(taskId, "none");
    write(taskId, {
      flight: "none",
      rejectUiOpen: read(taskId).windowExpired ? false : read(taskId).rejectUiOpen,
    });
    return fallback;
  }
}

export async function submitRejectOffer(
  taskId: string,
  reason: string,
): Promise<TaskActionResult> {
  if (!taskId) return { ok: false, message: "Missing task." };
  if (read(taskId).settled === "rejected") return { ok: true };
  if (read(taskId).settled === "accepted") {
    return {
      ok: false,
      message: USER_MESSAGES.offerAlreadyAccepted,
      reason: "already_accepted",
    };
  }
  if (!beginRejectOffer(taskId)) {
    return {
      ok: false,
      message: USER_MESSAGES.offerAlreadyAccepted,
      reason: "already_accepted",
    };
  }
  const existing = rejectPosts.get(taskId);
  if (existing) return existing;
  const promise = (async () => {
    const result = await rejectTaskAction(taskId, reason);
    if (result.ok) {
      claims.set(taskId, "none");
      write(taskId, {
        flight: "none",
        settled: "rejected",
        rejectUiOpen: false,
      });
      return result;
    }
    return reconcileFromBackend(taskId, result);
  })();
  rejectPosts.set(taskId, promise);
  try {
    return await promise;
  } finally {
    rejectPosts.delete(taskId);
  }
}

export function markOfferAccepted(taskId: string) {
  if (!taskId) return;
  if (read(taskId).settled === "rejected") return;
  if (claimOf(taskId) === "reject" && read(taskId).settled === "none") return;
  claims.set(taskId, "none");
  write(taskId, {
    flight: "none",
    settled: "accepted",
    rejectUiOpen: false,
    windowExpired: true,
    frozenRemainingMs: null,
  });
}

export function markOfferDecisionRejected(taskId: string) {
  if (!taskId) return;
  claims.set(taskId, "none");
  write(taskId, {
    flight: "none",
    settled: "rejected",
    rejectUiOpen: false,
    frozenRemainingMs: null,
  });
}

export function releaseOfferFlight(taskId: string, expiresAt?: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.settled !== "none") return;
  if (claimOf(taskId) === "reject" && state.flight === "reject") return;
  claims.set(taskId, "none");
  const windowStillOpen =
    expiresAt != null &&
    Number.isFinite(new Date(expiresAt).getTime()) &&
    Date.now() < new Date(expiresAt).getTime() &&
    !state.windowExpired;
  write(taskId, {
    flight: "none",
    rejectUiOpen: state.windowExpired ? false : state.rejectUiOpen,
    frozenRemainingMs: windowStillOpen || expiresAt == null ? null : state.frozenRemainingMs,
  });
}

export async function submitAcceptOffer(taskId: string): Promise<TaskActionResult> {
  if (!taskId) return { ok: false, message: "Missing task." };
  if (read(taskId).settled === "accepted") return { ok: true };
  if (read(taskId).settled === "rejected") {
    return {
      ok: false,
      message: "This offer was already rejected.",
      reason: "already_rejected",
    };
  }
  if (claimOf(taskId) === "reject" || read(taskId).flight === "reject") {
    return {
      ok: false,
      message: "This offer is being rejected.",
    };
  }
  beginAcceptOffer(taskId);
  if (read(taskId).settled === "rejected" || claimOf(taskId) === "reject") {
    return {
      ok: false,
      message: "This offer is being rejected.",
    };
  }
  if (read(taskId).flight !== "accept" && claimOf(taskId) !== "accept") {
    return {
      ok: false,
      message: USER_MESSAGES.offerAlreadyAccepted,
      reason: "already_accepted",
    };
  }
  const existing = acceptPosts.get(taskId);
  if (existing) return existing;
  const promise = (async () => {
    const result = await acceptTaskAction(taskId).catch((): TaskActionResult => ({
      ok: false,
      message: USER_MESSAGES.unknown,
    }));
    if (claimOf(taskId) === "reject" || read(taskId).settled === "rejected") {
      return {
        ok: false as const,
        message: "This offer was already rejected.",
        reason: "already_rejected" as const,
      };
    }
    if (result.ok) {
      markOfferAccepted(taskId);
      return result;
    }
    const live = await getOfferLiveStateAction(taskId).catch(() => null);
    if (live === "accepted") {
      markOfferAccepted(taskId);
      return { ok: true as const };
    }
    if (live === "rejected") {
      markOfferDecisionRejected(taskId);
      return {
        ok: false as const,
        message: "This offer was already rejected.",
        reason: "already_rejected" as const,
      };
    }
    releaseOfferFlight(taskId);
    return result;
  })();
  acceptPosts.set(taskId, promise);
  try {
    return await promise;
  } finally {
    acceptPosts.delete(taskId);
  }
}

export async function autoAcceptExpiredOffer(taskId: string): Promise<boolean> {
  if (!taskId) return offerWasAccepted(taskId);
  if (isOfferTimerPaused(taskId)) return offerWasAccepted(taskId);
  expireRejectWindow(taskId);
  if (claimOf(taskId) === "reject" || read(taskId).flight === "reject") {
    return false;
  }
  if (read(taskId).settled === "rejected") return false;
  if (read(taskId).settled === "accepted") return true;
  const pending = acceptPosts.get(taskId);
  if (pending) {
    const result = await pending;
    return result.ok || offerWasAccepted(taskId);
  }
  if (read(taskId).flight === "accept" || claimOf(taskId) === "accept") {
    return offerWasAccepted(taskId);
  }
  const result = await submitAcceptOffer(taskId);
  return result.ok;
}
