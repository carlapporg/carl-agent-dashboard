"use client";

import { acceptTaskAction } from "@/features/tasks/actions/task-actions";

const attempted = new Set<string>();
const accepted = new Set<string>();

export function offerWasAccepted(taskId: string): boolean {
  return accepted.has(taskId);
}

export function markOfferAccepted(taskId: string) {
  if (!taskId) return;
  attempted.add(taskId);
  accepted.add(taskId);
}

/** Accept while the offer window is still open, so Nest does not miss/reassign first. */
export async function autoAcceptExpiredOffer(taskId: string): Promise<boolean> {
  if (!taskId || attempted.has(taskId)) return accepted.has(taskId);
  attempted.add(taskId);
  const result = await acceptTaskAction(taskId).catch(() => ({
    ok: false as const,
  }));
  if (!result.ok) return false;
  accepted.add(taskId);
  return true;
}
