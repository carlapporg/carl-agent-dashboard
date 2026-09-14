"use client";

import { useEffect, useMemo, useRef } from "react";
import { useOps } from "@/features/ops/ops-provider";
import {
  getTaskConfirmationAction,
  getTaskReceiptAction,
} from "@/features/tasks/actions/task-actions";
import { shouldHydrateTaskConfirmation } from "@/features/tasks/lib/workflow";
import { isConfirmationConfirmed } from "@/types/confirmation";
import type { TaskConfirmation } from "@/types/confirmation";
import type { TaskReceipt } from "@/types/receipt";
import type { Task } from "@/types/task";

/** Survives component remounts so /tasks does not re-fetch forever. */
const confirmationSessionCache = new Map<string, TaskConfirmation | null>();
const receiptSessionCache = new Map<string, TaskReceipt | null>();
const confirmationInFlight = new Set<string>();

function waitingTaskIdsKey(tasks: Task[]): string {
  return tasks
    .filter(shouldHydrateTaskConfirmation)
    .map((task) => task.id)
    .sort()
    .join(",");
}

/**
 * Load confirmation/receipt for waiting tasks so list chips match task detail.
 * Session + in-flight dedupe prevents remount / Strict Mode fetch storms.
 */
export function useHydrateTaskConfirmations(tasks: Task[]) {
  const ops = useOps();
  const rememberConfirmation = ops?.rememberConfirmation;
  const rememberReceipt = ops?.rememberReceipt;
  const rememberConfirmationRef = useRef(rememberConfirmation);
  const rememberReceiptRef = useRef(rememberReceipt);
  rememberConfirmationRef.current = rememberConfirmation;
  rememberReceiptRef.current = rememberReceipt;

  const waitingIds = useMemo(() => waitingTaskIdsKey(tasks), [tasks]);

  // Seed React cache from session cache after remount (no network).
  useEffect(() => {
    const remember = rememberConfirmationRef.current;
    if (!remember || !waitingIds) return;
    for (const id of waitingIds.split(",").filter(Boolean)) {
      if (!confirmationSessionCache.has(id)) continue;
      remember(id, confirmationSessionCache.get(id) ?? null);
      if (rememberReceiptRef.current && receiptSessionCache.has(id)) {
        rememberReceiptRef.current(id, receiptSessionCache.get(id) ?? null);
      }
    }
  }, [waitingIds]);

  useEffect(() => {
    if (!rememberConfirmationRef.current || !waitingIds) return;

    for (const id of waitingIds.split(",").filter(Boolean)) {
      if (confirmationSessionCache.has(id)) continue;
      if (confirmationInFlight.has(id)) continue;

      confirmationInFlight.add(id);
      void getTaskConfirmationAction(id)
        .then((result) => {
          const row = result.ok ? result.confirmation : null;
          confirmationSessionCache.set(id, row);
          rememberConfirmationRef.current?.(id, row);

          if (!row || !isConfirmationConfirmed(row)) return;
          if (receiptSessionCache.has(id)) {
            rememberReceiptRef.current?.(
              id,
              receiptSessionCache.get(id) ?? null,
            );
            return;
          }
          return getTaskReceiptAction(id).then((receiptResult) => {
            const receipt = receiptResult.ok ? receiptResult.receipt : null;
            receiptSessionCache.set(id, receipt);
            rememberReceiptRef.current?.(id, receipt);
          });
        })
        .finally(() => {
          confirmationInFlight.delete(id);
        });
    }
  }, [waitingIds]);
}
