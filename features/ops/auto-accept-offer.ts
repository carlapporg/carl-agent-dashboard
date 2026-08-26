"use client";

import { useSyncExternalStore } from "react";
import { acceptTaskAction } from "@/features/tasks/actions/task-actions";
import { beginHideRejected } from "@/features/ops/rejected-offers";

/**
 * Fire auto-accept only when the clock is essentially at 0.
 * A 2.5s early fire made "3s left" already send Accept.
 */
export const EARLY_ACCEPT_MS = 200;

type OfferFlight = "none" | "accept" | "reject";
type OfferSettled = "none" | "accepted" | "rejected";

export type OfferDecision = {
  flight: OfferFlight;
  settled: OfferSettled;
  autoAcceptBlocked: boolean;
  rejectUiOpen: boolean;
};

const EMPTY: OfferDecision = {
  flight: "none",
  settled: "none",
  autoAcceptBlocked: false,
  rejectUiOpen: false,
};

const states = new Map<string, OfferDecision>();
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
  const next = { ...read(taskId), ...patch };
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
    !state.autoAcceptBlocked &&
    !state.rejectUiOpen
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
    state.rejectUiOpen
  );
}

/** Drop any in-flight auto-accept so a later response cannot mark the offer assigned. */
export function cancelInFlightAutoAccept(taskId: string) {
  if (!taskId) return;
  bumpAutoAcceptGen(taskId);
  const state = read(taskId);
  if (state.settled === "rejected") return;
  if (state.flight === "accept") {
    write(taskId, {
      flight: "none",
      autoAcceptBlocked: true,
    });
    return;
  }
  write(taskId, { autoAcceptBlocked: true });
}

/** Stop auto-accept as soon as the agent clicks Reject. */
export function openRejectOfferUi(taskId: string) {
  if (!taskId) return;
  if (read(taskId).settled === "rejected") return;
  cancelInFlightAutoAccept(taskId);
  write(taskId, {
    autoAcceptBlocked: true,
    rejectUiOpen: true,
  });
}

/** Keep auto-accept off after the reject dialog closes. */
export function closeRejectOfferUi(taskId: string, _expiresAt?: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (!state.rejectUiOpen) return;
  if (state.flight === "reject" || state.settled !== "none") {
    write(taskId, { rejectUiOpen: false });
    return;
  }
  write(taskId, {
    rejectUiOpen: false,
    autoAcceptBlocked: true,
  });
}

export function beginAcceptOffer(taskId: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.flight === "reject" || state.settled !== "none" || state.rejectUiOpen) {
    return false;
  }
  if (state.flight === "accept") return false;
  write(taskId, {
    flight: "accept",
    autoAcceptBlocked: true,
    rejectUiOpen: false,
  });
  return true;
}

export function beginRejectOffer(taskId: string): boolean {
  if (!taskId) return false;
  const state = read(taskId);
  if (state.settled === "rejected") return true;
  if (state.settled === "accepted") return false;
  cancelInFlightAutoAccept(taskId);
  beginHideRejected(taskId);
  write(taskId, {
    flight: "reject",
    autoAcceptBlocked: true,
    rejectUiOpen: true,
    settled: "none",
  });
  return true;
}

export function markOfferAccepted(taskId: string) {
  if (!taskId) return;
  if (isRejectingOrRejected(taskId)) return;
  write(taskId, {
    flight: "none",
    settled: "accepted",
    autoAcceptBlocked: true,
    rejectUiOpen: false,
  });
}

export function markOfferDecisionRejected(taskId: string) {
  if (!taskId) return;
  write(taskId, {
    flight: "none",
    settled: "rejected",
    autoAcceptBlocked: true,
    rejectUiOpen: false,
  });
}

/** After a failed request: unlock buttons, keep auto-accept off. */
export function releaseOfferFlight(taskId: string) {
  if (!taskId) return;
  const state = read(taskId);
  if (state.flight === "none" || state.settled !== "none") return;
  write(taskId, { flight: "none", autoAcceptBlocked: true });
}

export async function autoAcceptExpiredOffer(taskId: string): Promise<boolean> {
  if (!taskId || !canAutoAcceptOffer(taskId)) {
    return offerWasAccepted(taskId);
  }
  const gen = autoAcceptGen.get(taskId) ?? 0;
  if (!beginAcceptOffer(taskId)) return offerWasAccepted(taskId);
  const result = await acceptTaskAction(taskId).catch(() => ({
    ok: false as const,
  }));
  if ((autoAcceptGen.get(taskId) ?? 0) !== gen || isRejectingOrRejected(taskId)) {
    return false;
  }
  if (!result.ok) {
    releaseOfferFlight(taskId);
    return false;
  }
  markOfferAccepted(taskId);
  return true;
}
