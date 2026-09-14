"use client";

import { useEffect } from "react";
import {
  autoAcceptExpiredOffer,
  autoRejectOfflineOffer,
  getOfferTimerGeneration,
  isOfferTimerPaused,
  isRejectingOrRejected,
  markOfferAccepted,
  markOfferDecisionRejected,
  offerWasAccepted,
} from "@/features/ops/auto-accept-offer";
import { getOfferLiveStateAction } from "@/features/tasks/actions/task-actions";
import { liveStatusPatch, taskProgressRank } from "@/lib/tasks/merge-live-task";
import { offerAutoAssignAtMs, offerWindowEnd } from "@/types/agent";
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

const MAX_ATTEMPTS = 8;
const RECOVERY_SWEEP_MS = 4_000;
const inFlight = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type AssignRefs = {
  patchLiveTask: (taskId: string, patch: Partial<Task>, fallback?: Task) => void;
  dropLiveTask: (taskId: string) => void;
  tasks: Task[];
  refresh: () => void;
  getPresence: () => AgentPresence;
};

const refs: AssignRefs = {
  patchLiveTask: () => undefined,
  dropLiveTask: () => undefined,
  tasks: [],
  refresh: () => undefined,
  getPresence: () => "AVAILABLE",
};

function seedFor(taskId: string): Task | undefined {
  return refs.tasks.find((row) => row.id === taskId);
}

/** Auto-assign only after Nest's reject grace (rejectUntil + 5s). */
function isAutoAssignDue(task: Task | undefined): boolean {
  if (!task) return false;
  return Date.now() >= offerAutoAssignAtMs(task);
}

function isAgentOffline(): boolean {
  return refs.getPresence() === "OFFLINE";
}

async function resolveOfferOutcome(
  taskId: string,
  seed: Task | undefined,
): Promise<boolean> {
  const live = await getOfferLiveStateAction(taskId).catch(() => null);
  const current = seedFor(taskId) ?? seed;
  if (live === "accepted" || offerWasAccepted(taskId)) {
    markOfferAccepted(taskId);
    if (current && taskProgressRank(current) > 2) {
      refs.refresh();
      return true;
    }
    refs.patchLiveTask(taskId, liveStatusPatch("ASSIGNED", "assigned"), current);
    refs.refresh();
    return true;
  }
  if (live === "rejected") {
    markOfferDecisionRejected(taskId);
    refs.dropLiveTask(taskId);
    refs.refresh();
    return true;
  }
  if (live === "gone") {
    refs.dropLiveTask(taskId);
    refs.refresh();
    return true;
  }
  return false;
}

async function settleExpiredOrOfflineOffer(taskId: string, expectedGen: number) {
  if (getOfferTimerGeneration(taskId) !== expectedGen) return;
  if (inFlight.has(taskId) || isRejectingOrRejected(taskId)) return;
  if (isOfferTimerPaused(taskId)) return;

  const seed = seedFor(taskId);
  if (seed && seed.backendStatus !== "OFFERED") {
    if (seed.backendStatus === "ASSIGNED" && taskProgressRank(seed) <= 2) {
      markOfferAccepted(taskId);
      refs.patchLiveTask(taskId, liveStatusPatch("ASSIGNED", "assigned"), seed);
      refs.refresh();
    }
    return;
  }

  inFlight.add(taskId);
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (getOfferTimerGeneration(taskId) !== expectedGen) return;
      if (isRejectingOrRejected(taskId)) return;

      if (await resolveOfferOutcome(taskId, seed)) return;

      // Offline → auto-reject. Never auto-accept while OFFLINE.
      if (isAgentOffline()) {
        const rejected = await autoRejectOfflineOffer(taskId);
        if (getOfferTimerGeneration(taskId) !== expectedGen) return;
        if (rejected || isRejectingOrRejected(taskId)) {
          refs.dropLiveTask(taskId);
          refs.refresh();
          return;
        }
        if (await resolveOfferOutcome(taskId, seed)) return;
        await sleep(800 * (attempt + 1));
        continue;
      }

      const ok = await autoAcceptExpiredOffer(taskId);
      if (getOfferTimerGeneration(taskId) !== expectedGen) return;

      if (ok || offerWasAccepted(taskId)) {
        const latest = seedFor(taskId) ?? seed;
        if (!latest || taskProgressRank(latest) <= 2) {
          refs.patchLiveTask(
            taskId,
            liveStatusPatch("ASSIGNED", "assigned"),
            latest ?? seed,
          );
        }
        refs.refresh();
        return;
      }

      if (await resolveOfferOutcome(taskId, seed)) return;

      await sleep(800 * (attempt + 1));
    }

    await resolveOfferOutcome(taskId, seed);
  } finally {
    inFlight.delete(taskId);
  }
}

function scheduleAutoAssign(task: Task, timers: Map<string, number>) {
  if (task.backendStatus !== "OFFERED") return;
  if (isRejectingOrRejected(task.id)) return;
  if (isOfferTimerPaused(task.id)) return;
  if (inFlight.has(task.id) || timers.has(task.id)) return;

  const gen = getOfferTimerGeneration(task.id);
  // Offline: reject ASAP instead of waiting for the accept timer.
  const wait = isAgentOffline()
    ? 50
    : Math.max(50, offerAutoAssignAtMs(task) - Date.now() + 50);
  const taskId = task.id;

  timers.set(
    taskId,
    window.setTimeout(() => {
      timers.delete(taskId);
      void settleExpiredOrOfflineOffer(taskId, gen);
    }, wait),
  );
}

/**
 * One timer per offered task, independent of which page is open.
 * Nest decides OFFERED vs ASSIGNED; offline agents auto-reject.
 */
export function useOfferAutoAssign(args: {
  tasks: Task[];
  presence: AgentPresence;
  patchLiveTask: (taskId: string, patch: Partial<Task>, fallback?: Task) => void;
  dropLiveTask: (taskId: string) => void;
  refresh: () => void;
}) {
  refs.patchLiveTask = args.patchLiveTask;
  refs.dropLiveTask = args.dropLiveTask;
  refs.tasks = args.tasks;
  refs.refresh = args.refresh;
  refs.getPresence = () => args.presence;

  const offeredKey = args.tasks
    .filter((task) => task.backendStatus === "OFFERED")
    .map((task) => `${task.id}:${offerWindowEnd(task)}`)
    .sort()
    .join("|");

  useEffect(() => {
    const timers = new Map<string, number>();

    for (const task of refs.tasks) {
      scheduleAutoAssign(task, timers);
    }

    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, [offeredKey, args.presence]);

  // Going OFFLINE with open offers → reject immediately.
  useEffect(() => {
    if (args.presence !== "OFFLINE") return;
    for (const task of refs.tasks) {
      if (task.backendStatus !== "OFFERED") continue;
      if (isRejectingOrRejected(task.id)) continue;
      if (inFlight.has(task.id)) continue;
      const gen = getOfferTimerGeneration(task.id);
      void settleExpiredOrOfflineOffer(task.id, gen);
    }
  }, [args.presence, offeredKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      for (const task of refs.tasks) {
        if (task.backendStatus !== "OFFERED") continue;
        if (isRejectingOrRejected(task.id)) continue;
        if (isOfferTimerPaused(task.id)) continue;
        if (inFlight.has(task.id)) continue;
        if (!isAgentOffline() && !isAutoAssignDue(task)) continue;
        const gen = getOfferTimerGeneration(task.id);
        void settleExpiredOrOfflineOffer(task.id, gen);
      }
    }, RECOVERY_SWEEP_MS);

    return () => window.clearInterval(id);
  }, [offeredKey, args.presence]);
}
