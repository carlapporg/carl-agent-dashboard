"use client";

import { useSyncExternalStore } from "react";
import type { Task } from "@/types/task";

const STORAGE_KEY = "carl.rejected-offers";

const listeners = new Set<() => void>();
let version = 0;
const pendingIds = new Set<string>();

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Private mode / blocked storage.
  }
}

function readIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const local = window.localStorage.getItem(STORAGE_KEY);
    const session = window.sessionStorage.getItem(STORAGE_KEY);
    const raw = local ?? session;
    if (!raw) return new Set();
    if (!local && session) {
      window.localStorage.setItem(STORAGE_KEY, session);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id) => typeof id === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function useRejectedOfferTick(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

export function isMarkedRejected(taskId: string): boolean {
  return pendingIds.has(taskId) || readIds().has(taskId);
}

export function isPendingReject(taskId: string): boolean {
  return pendingIds.has(taskId);
}

/** Call as soon as the agent confirms Reject, before the API returns. */
export function beginHideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.add(taskId);
  const ids = readIds();
  ids.add(taskId);
  writeIds(ids);
  emit();
}

export function finishHideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.delete(taskId);
  const ids = readIds();
  ids.add(taskId);
  writeIds(ids);
  emit();
}

export function unhideRejected(taskId: string) {
  if (!taskId) return;
  pendingIds.delete(taskId);
  const ids = readIds();
  ids.delete(taskId);
  writeIds(ids);
  emit();
}

export function markOfferRejected(taskId: string) {
  finishHideRejected(taskId);
}

export function isRejectedOffer(task: Pick<Task, "backendStatus">): boolean {
  return task.backendStatus === "REJECTED";
}

/** Hide rejected offers for this agent. Never un-hide if Nest later sends ASSIGNED/FAILED. */
export function shouldHideRejectedOffer(task: Task): boolean {
  if (isRejectedOffer(task)) return true;
  if (!readIds().has(task.id) && !pendingIds.has(task.id)) return false;
  if (pendingIds.has(task.id)) return false;
  return true;
}

export function withoutRejectedOffers(tasks: Task[]): Task[] {
  return tasks.filter((task) => !shouldHideRejectedOffer(task));
}
