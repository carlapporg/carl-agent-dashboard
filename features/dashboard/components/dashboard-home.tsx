"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import { MonthFilterPill } from "@/features/dashboard/components/month-filter-pill";
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
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  tasks: Task[];
  presence?: AgentPresence;
};

function MetricIcon({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={26} height={26} className="size-[26px]" />
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
      queued += 1;
    }

    const stillInQueue = offered + queued + waitingCustomer;
    const total = Math.max(roots.length, 1);
    const inMotionShare = completed + inProgress;
    const progressPct = Math.round((inMotionShare / total) * 100);

    return {
      offered,
      inProgress,
      waitingCustomer,
      completed,
      stillInQueue,
      total,
      progressPct,
      activeTaskCount: offered + inProgress + waitingCustomer + queued,
    };
  }, [roots]);

  return (
    <div className="space-y-5">
      <WsConnectionBanner />

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
            Sales Overview
          </h1>
          <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
            Your current sales summary and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AvailabilityToggle activeTaskCount={stats.activeTaskCount} />
          <MonthFilterPill />
        </div>
      </section>

      <div className="grid gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard
          label="Needs Attention"
          value={stats.offered}
          hint="Offered - Accept or reject in 30 seconds."
          icon={<MetricIcon src="/figma/dashboard/alert-02.svg" />}
          variant="featured"
          className="dash-slide-in"
        />
        <MetricStatCard
          label="In Progress"
          value={stats.inProgress}
          hint={`${stats.inProgress} tasks are currently being processed for customers.`}
          icon={<MetricIcon src="/figma/dashboard/refresh-ccw.svg" />}
          variant="plain"
          className="dash-slide-in"
          style={{ animationDelay: "60ms" } as CSSProperties}
        />
        <MetricStatCard
          label="Waiting on Customer"
          value={stats.waitingCustomer}
          hint="Waiting for users from Nest."
          icon={<MetricIcon src="/figma/dashboard/copy-03.svg" />}
          variant="plainCyan"
          className="dash-slide-in"
          style={{ animationDelay: "120ms" } as CSSProperties}
        />
        <MetricStatCard
          label="Completed"
          value={stats.completed}
          hint="Finished in this list."
          icon={<MetricIcon src="/figma/dashboard/check-square-02.svg" />}
          variant="plainGreen"
          badge="4.9%"
          className="dash-slide-in"
          style={{ animationDelay: "180ms" } as CSSProperties}
        />
      </div>

      <div className="grid gap-[25px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-stretch">
        <TasksPerHourPanel className="dash-slide-in min-h-[424px]" />
        <ShiftProgress
          completed={stats.completed}
          inProgress={stats.inProgress}
          total={stats.total}
          waiting={stats.stillInQueue}
          progressPercent={stats.progressPct}
          className="dash-slide-in"
        />
      </div>

      <LiveTaskQueue seedTasks={roots} />
    </div>
  );
}
