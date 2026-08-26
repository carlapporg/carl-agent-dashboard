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
};

const EMPTY: OfferDecision = {
  flight: "none",
  settled: "none",
  rejectUiOpen: false,
  windowExpired: false,
};

const states = new Map<string, OfferDecision>();
const claims = new Map<string, OfferClaim>();
const autoAcceptGen = new Map<string, number>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function read(taskId: string): OfferDecision {
  return states.get(taskId) ?? EMPTY;
}

function write(taskId: string, patch: Partial<OfferDecision>) {
  if (!taskId) return;
  const next = { ...EMPTY, ...(states.get(taskId) ?? EMPTY), ...patch };
  states.set(taskId, next);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function bumpAutoAcceptGen(taskId: string) {
  autoAcceptGen.set(taskId, (autoAcceptGen.get(taskId) ?? 0) + 1);
}

function claimOf(taskId: string): OfferClaim {
  return claims.get(taskId) ?? "none";
}

export function useOfferDecision(taskId?: string): OfferDecision {
  return useSyncExternalStore(
    subscribe,
    () => (taskId ? read(taskId) : EMPTY),
    () => EMPTY,
  );
}

export function canAutoAcceptOffer(taskId: string): boolean {
  const state = read(taskId);
  return (
    state.settled === "none" &&
    state.flight === "none" &&
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

/** Invalidate any in-flight auto-accept without opening a gap at flight=none. */
export function cancelInFlightAutoAccept(taskId: string) {
  if (!taskId) return;
  bumpAutoAcceptGen(taskId);
}

export function openRejectOfferUi(taskId: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.settled !== "none" || state.windowExpired) return;
  if (claimOf(taskId) === "accept") return;
  write(taskId, { rejectUiOpen: true });
}

export function closeRejectOfferUi(taskId: string, _expiresAt?: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (!state.rejectUiOpen) return;
  if (state.flight === "reject" || claimOf(taskId) === "reject") return;
  write(taskId, { rejectUiOpen: false });
}

export function expireRejectWindow(taskId: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.settled !== "none") return;
  const rejecting = state.flight === "reject" || claimOf(taskId) === "reject";
  write(taskId, {
    windowExpired: true,
    rejectUiOpen: rejecting ? state.rejectUiOpen : false,
  });
}

export function beginAcceptOffer(taskId: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.settled !== "none") return false;
  if (state.flight === "reject" || claimOf(taskId) === "reject") return false;
  if (state.flight === "accept" || claimOf(taskId) === "accept") return false;
  claims.set(taskId, "accept");
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
export function beginRejectOffer(taskId: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.settled === "rejected" || claimOf(taskId) === "reject") return true;
  if (state.settled === "accepted") return false;
  claims.set(taskId, "reject");
  bumpAutoAcceptGen(taskId);
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
  });
}

export function markOfferDecisionRejected(taskId: string) {
  if (!taskId) return;
  claims.set(taskId, "none");
  write(taskId, {
    flight: "none",
    settled: "rejected",
    rejectUiOpen: false,
  });
}

export function releaseOfferFlight(taskId: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.settled !== "none") return;
  if (claimOf(taskId) === "reject" && state.flight === "reject") return;
  claims.set(taskId, "none");
  write(taskId, {
    flight: "none",
    rejectUiOpen: state.windowExpired ? false : state.rejectUiOpen,
  });
}

export async function autoAcceptExpiredOffer(taskId: string): Promise<boolean> {
  if (!taskId) return offerWasAccepted(taskId);
  expireRejectWindow(taskId);
  if (claimOf(taskId) === "reject" || read(taskId).flight === "reject") {
    return false;
  }
  if (read(taskId).settled === "rejected") return false;
  if (!canAutoAcceptOffer(taskId)) {
    return offerWasAccepted(taskId);
  }
  if (!beginAcceptOffer(taskId)) return offerWasAccepted(taskId);
  if (claimOf(taskId) === "reject" || read(taskId).flight === "reject") {
    return false;
  }
  const gen = autoAcceptGen.get(taskId) ?? 0;
  const result = await acceptTaskAction(taskId).catch((): TaskActionResult => ({
    ok: false,
    message: USER_MESSAGES.unknown,
  }));
  if ((autoAcceptGen.get(taskId) ?? 0) !== gen) {
    return false;
  }
  if (read(taskId).settled === "rejected" || claimOf(taskId) === "reject") {
    return false;
  }
  if (result.ok) {
    markOfferAccepted(taskId);
    return true;
  }
  const live = await getOfferLiveStateAction(taskId).catch(() => null);
  if (live === "accepted") {
    markOfferAccepted(taskId);
    return true;
  }
  if (live === "rejected") {
    markOfferDecisionRejected(taskId);
    return false;
  }
  releaseOfferFlight(taskId);
  return false;
}
