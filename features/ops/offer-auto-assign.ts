"use client";

import { useEffect, useRef } from "react";
import {
  autoAcceptExpiredOffer,
  isRejectingOrRejected,
  markOfferAccepted,
  markOfferDecisionRejected,
  offerWasAccepted,
} from "@/features/ops/auto-accept-offer";
import { getOfferLiveStateAction } from "@/features/tasks/actions/task-actions";
import { liveStatusPatch } from "@/lib/tasks/merge-live-task";
import { offerWindowEnd } from "@/types/agent";
import type { Task } from "@/types/task";

const MAX_ATTEMPTS = 8;
const inFlight = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * One timer per offered task, independent of which page is open.
 * The local clock only schedules the check. Nest decides OFFERED vs ASSIGNED.
 */
export function useOfferAutoAssign(args: {
  tasks: Task[];
  patchLiveTask: (taskId: string, patch: Partial<Task>, fallback?: Task) => void;
  dropLiveTask: (taskId: string) => void;
}) {
  const patchRef = useRef(args.patchLiveTask);
  patchRef.current = args.patchLiveTask;
  const dropRef = useRef(args.dropLiveTask);
  dropRef.current = args.dropLiveTask;
  const tasksRef = useRef(args.tasks);
  tasksRef.current = args.tasks;

  const offeredKey = args.tasks
    .filter((task) => task.backendStatus === "OFFERED")
    .map((task) => `${task.id}:${offerWindowEnd(task)}`)
    .sort()
    .join("|");

  useEffect(() => {
    const timers = new Map<string, number>();

    function seedFor(taskId: string): Task | undefined {
      return tasksRef.current.find((row) => row.id === taskId);
    }

    async function assignIfStillOffered(taskId: string) {
      if (inFlight.has(taskId) || isRejectingOrRejected(taskId)) return;
      inFlight.add(taskId);
      const seed = seedFor(taskId);
      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (isRejectingOrRejected(taskId)) return;
          const live = await getOfferLiveStateAction(taskId).catch(() => null);
          if (live === "accepted" || offerWasAccepted(taskId)) {
            markOfferAccepted(taskId);
            patchRef.current(
              taskId,
              liveStatusPatch("ASSIGNED", "assigned"),
              seed,
            );
            return;
          }
          if (live === "rejected") {
            markOfferDecisionRejected(taskId);
            dropRef.current(taskId);
            return;
          }
          if (live === "gone") {
            dropRef.current(taskId);
            return;
          }
          const ok = await autoAcceptExpiredOffer(taskId);
          if (ok || offerWasAccepted(taskId)) {
            patchRef.current(
              taskId,
              liveStatusPatch("ASSIGNED", "assigned"),
              seed,
            );
            return;
          }
          await sleep(800 * (attempt + 1));
        }
      } finally {
        inFlight.delete(taskId);
      }
    }

    for (const task of tasksRef.current) {
      if (task.backendStatus !== "OFFERED") continue;
      if (isRejectingOrRejected(task.id)) continue;
      if (inFlight.has(task.id) || timers.has(task.id)) continue;
      const wait = Math.max(
        50,
        new Date(offerWindowEnd(task)).getTime() - Date.now() + 50,
      );
      const taskId = task.id;
      timers.set(
        taskId,
        window.setTimeout(() => {
          timers.delete(taskId);
          void assignIfStillOffered(taskId);
        }, wait),
      );
    }

    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, [offeredKey]);
}
