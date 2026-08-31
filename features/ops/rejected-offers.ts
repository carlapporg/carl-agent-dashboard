"use client";

import { useSyncExternalStore } from "react";
import type { Task } from "@/types/task";

const listeners = new Set<() => void>();
let version = 0;
const pendingIds = new Set<string>();
const hiddenIds = new Set<string>();

const LEGACY_KEYS = ["carl.rejected-offers"] as const;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dropLegacyStores() {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Private mode / blocked storage.
  }
}

dropLegacyStores();

export function useRejectedOfferTick(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

export function isMarkedRejected(taskId: string): boolean {
  return pendingIds.has(taskId) || hiddenIds.has(taskId);
}

export function isPendingReject(taskId: string): boolean {
  return pendingIds.has(taskId);
}

/** Call as soon as the agent confirms Reject, before the API returns. */
export function beginHideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.add(taskId);
  emit();
}

export function finishHideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.delete(taskId);
  hiddenIds.add(taskId);
  emit();
}

export function unhideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.delete(taskId);
  hiddenIds.delete(taskId);
  emit();
}

export function markOfferRejected(taskId: string) {
  finishHideRejected(taskId);
}

export function isRejectedOffer(task: Pick<Task, "backendStatus">): boolean {
  return task.backendStatus === "REJECTED";
}

/** Hide while Nest says REJECTED, or this session already rejected it. */
export function shouldHideRejectedOffer(task: Task): boolean {
  if (isRejectedOffer(task)) return true;
  if (pendingIds.has(task.id)) return false;
  return hiddenIds.has(task.id);
}

export function withoutRejectedOffers(tasks: Task[]): Task[] {
  return tasks.filter((task) => !shouldHideRejectedOffer(task));
}
