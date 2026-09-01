"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
import {
  ShiftProgress,
  TasksPerHourPanel,
} from "@/features/dashboard/components/shift-progress";
import { WsConnectionBanner } from "@/features/dashboard/components/ws-connection-banner";
import { useOps } from "@/features/ops/ops-provider";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { PageShell } from "@/components/ui/page-shell";
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  tasks: Task[];
  presence?: AgentPresence;
};

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path
        d="M16 11a3 3 0 1 0-2.8-4M8 11a3 3 0 1 1 2.8-4M4 19c.8-2.6 2.7-4 5-4s4.2 1.4 5 4M14 15c2.3 0 4.2 1.4 5 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.8C19 15.6 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path
        d="M5 21V5m0 0h9l-1.5 3L14 11H5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path
        d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M14 3v4h4M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardHome({ tasks }: DashboardHomeProps) {
  const ops = useOps();
  const hydrateOpenTasks = ops?.hydrateOpenTasks;
  const rejectedTick = useRejectedOfferTick();

  useEffect(() => {
    hydrateOpenTasks?.(tasks);
  }, [hydrateOpenTasks, tasks]);

  const roots = useMemo(() => {
    const merged = mergeTaskLists(
      tasks.filter((t) => !t.parentId),
      ops?.liveTasks ?? [],
      ops?.offer,
    );
    return withoutRejectedOffers(merged);
  }, [tasks, ops?.liveTasks, ops?.offer, ops?.queuePulse, rejectedTick]);

  const stats = useMemo(() => {
    let offered = 0;
    let inProgress = 0;
    let waitingCustomer = 0;
    let completed = 0;
    let queued = 0;

    for (const t of roots) {
      const backend = t.backendStatus;
      if (backend === "COMPLETED" || t.status === "completed") {
        completed += 1;
        continue;
      }
      if (
        backend === "WAITING_FOR_USER" ||
        t.status === "waiting_for_customer" ||
        t.status === "waiting_for_payment"
      ) {
        waitingCustomer += 1;
        continue;
      }
      if (
        backend === "IN_PROGRESS" ||
        backend === "WAITING_FOR_AGENT" ||
        t.status === "in_progress"
      ) {
        inProgress += 1;
        continue;
      }
      if (backend === "OFFERED" || t.status === "queued") {
        offered += 1;
        continue;
      }
      // ASSIGNED / other open tasks still sit in the queue ring
      queued += 1;
    }

    const stillInQueue = offered + queued + waitingCustomer;
    const total = Math.max(roots.length, 1);
    const inMotionShare = completed + inProgress;
    const progressPct = Math.round((inMotionShare / total) * 100);
    const inProgressPct = Math.round((inProgress / total) * 100);

    return {
      offered,
      inProgress,
      inProgressPct,
      waitingCustomer,
      completed,
      stillInQueue,
      total,
      progressPct,
      activeTaskCount: offered + inProgress + waitingCustomer + queued,
    };
  }, [roots]);

  return (
    <PageShell wide>
      <WsConnectionBanner />

      <div className="space-y-5">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4 shadow-[var(--shadow-card)] md:px-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Agent Availability
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Controls whether Nest can offer you new tasks. Busy and offline
              pause new offers.
            </p>
          </div>
          <AvailabilityToggle activeTaskCount={stats.activeTaskCount} />
        </section>
        {/*
          Figma: left = 2×2 stats + Tasks/Hour; right = Shift Progress
          spanning the full combined height. Bottoms of chart + shift align.
        */}
        <div className="grid gap-4 lg:min-h-[28rem] lg:grid-cols-[minmax(0,2.85fr)_minmax(0,2.15fr)] lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 sm:auto-rows-[1fr]">
              <MetricStatCard
                label="Needs Attention"
                value={stats.offered}
                hint="OFFERED — accept or reject in 30 seconds."
                icon={<UsersIcon />}
                className="dash-slide-in h-full min-h-[7.75rem]"
              />
              <MetricStatCard
                label="In Progress"
                value={`${stats.inProgressPct}%`}
                hint="Started work in motion."
                icon={<HeartIcon />}
                className="dash-slide-in h-full min-h-[7.75rem]"
                style={{ animationDelay: "60ms" } as CSSProperties}
              />
              <MetricStatCard
                label="Waiting on Customer"
                value={stats.waitingCustomer}
                hint="WAITING_FOR_USER from Nest."
                icon={<FlagIcon />}
                className="dash-slide-in h-full min-h-[7.75rem]"
                style={{ animationDelay: "120ms" } as CSSProperties}
              />
              <MetricStatCard
                label="Completed"
                value={stats.completed}
                hint="Finished in this list."
                icon={<DocIcon />}
                className="dash-slide-in h-full min-h-[7.75rem]"
                style={{ animationDelay: "180ms" } as CSSProperties}
              />
            </div>

            <TasksPerHourPanel className="dash-slide-in shrink-0" />
          </div>

          <ShiftProgress
            completed={stats.completed}
            inProgress={stats.inProgress}
            total={stats.total}
            waiting={stats.stillInQueue}
            progressPercent={stats.progressPct}
            className="dash-slide-in h-full min-h-0"
          />
        </div>

        <LiveTaskQueue seedTasks={roots} />
      </div>
    </PageShell>
  );
}
