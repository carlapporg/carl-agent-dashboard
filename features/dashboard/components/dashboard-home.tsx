"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  getDashboardOverviewAction,
} from "@/features/dashboard/actions";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import {
  MonthFilterPill,
  type MonthFilterValue,
} from "@/features/dashboard/components/month-filter-pill";
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
import type { DashboardOverview } from "@/lib/api/dashboard-analytics";
import {
  bucketLiveQueueTasks,
  filterLiveQueueTasks,
  filterQueueTableTasks,
  toLiveDayFilter,
} from "@/lib/dashboard/live-queue";
import {
  formatDeltaPercent,
  toDashboardRange,
} from "@/lib/dashboard/range";
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  tasks: Task[];
  presence?: AgentPresence;
};

function MetricIconAlert() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden className="size-[26px]">
      <path
        d="M13 8.7v5.4M13 17.3h.01M7.4 23.8h11.2c1.8 0 2.7 0 3.4-.35a3.25 3.25 0 0 0 1.4-1.4c.35-.7.35-1.6.35-3.4V7.4c0-1.8 0-2.7-.35-3.4a3.25 3.25 0 0 0-1.4-1.4C21.3 2.2 20.4 2.2 18.6 2.2H7.4c-1.8 0-2.7 0-3.4.35a3.25 3.25 0 0 0-1.4 1.4C2.2 4.7 2.2 5.6 2.2 7.4v11.2c0 1.8 0 2.7.35 3.4a3.25 3.25 0 0 0 1.4 1.4c.7.35 1.6.35 3.4.35Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Progress / working — more fitting than a refresh arrow. */
function MetricIconInProgress() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden className="size-[26px]">
      <circle
        cx="13"
        cy="13"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.75"
        opacity="0.35"
      />
      <path
        d="M13 3.75a9.25 9.25 0 0 1 9.25 9.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M11.2 9.4 16.5 13l-5.3 3.6V9.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Waiting — clock, not copy/windows. */
function MetricIconWaiting() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden className="size-[26px]">
      <circle
        cx="13"
        cy="13"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M13 8.2V13l3.4 2.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricIconCompleted() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden className="size-[26px]">
      <path
        d="M22.8 11.9v5.6c0 1.8 0 2.7-.36 3.4a3.25 3.25 0 0 1-1.4 1.4c-.7.36-1.6.36-3.4.36H8.5c-1.8 0-2.7 0-3.4-.36a3.25 3.25 0 0 1-1.4-1.4C3.3 20.2 3.3 19.3 3.3 17.5V8.5c0-1.8 0-2.7.36-3.4a3.25 3.25 0 0 1 1.4-1.4C5.8 3.3 6.7 3.3 8.5 3.3h7.8M8.6 13l3 3.4L22.8 4.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardHome({ tasks }: DashboardHomeProps) {
  const ops = useOps();
  const hydrateOpenTasks = ops?.hydrateOpenTasks;
  const rejectedTick = useRejectedOfferTick();
  const [rangeLabel, setRangeLabel] = useState<MonthFilterValue>("Today");
  const range = toDashboardRange(rangeLabel);
  const dayFilter = toLiveDayFilter(rangeLabel);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    hydrateOpenTasks?.(tasks);
  }, [hydrateOpenTasks, tasks]);

  const loadOverview = useCallback(async () => {
    try {
      const row = await getDashboardOverviewAction(range);
      setOverview(row);
    } catch {
      setOverview(null);
    }
  }, [range]);

  // Range changes only — do not refetch on queuePulse (that loops with server actions).
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const roots = useMemo(() => {
    const merged = mergeTaskLists(
      tasks.filter((t) => !t.parentId),
      ops?.liveTasks ?? [],
      ops?.offer,
    );
    return withoutRejectedOffers(merged);
  }, [tasks, ops?.liveTasks, ops?.offer, rejectedTick]);

  /** Open-only — metric cards + Task Progress. */
  const liveQueueItems = useMemo(
    () => filterLiveQueueTasks(roots, dayFilter),
    [roots, dayFilter],
  );

  /** Open + completed — Live Task Queue table. */
  const queueTableItems = useMemo(
    () => filterQueueTableTasks(roots, dayFilter),
    [roots, dayFilter],
  );

  const liveBuckets = useMemo(
    () =>
      bucketLiveQueueTasks(
        liveQueueItems,
        ops?.confirmationsByTaskId,
        ops?.receiptsByTaskId,
      ),
    [liveQueueItems, ops?.confirmationsByTaskId, ops?.receiptsByTaskId],
  );

  const stats = useMemo(() => {
    const completed = overview?.completed ?? 0;
    const { offered, inProgress, waitingCustomer, waiting, liveCount } =
      liveBuckets;
    const total = Math.max(completed + liveCount, 1);
    return {
      offered,
      inProgress,
      waitingCustomer,
      completed,
      waiting,
      total: completed + liveCount,
      progressPct: Math.round(((completed + inProgress) / total) * 100),
      activeTaskCount: liveCount,
      deltaBadge: formatDeltaPercent(overview?.completedDeltaPercent),
    };
  }, [liveBuckets, overview]);

  return (
    <div className="space-y-5">
      <WsConnectionBanner />

      <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[34px]">
            Sales Overview
          </h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <AvailabilityToggle activeTaskCount={stats.activeTaskCount} />
          <MonthFilterPill value={rangeLabel} onChange={setRangeLabel} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-[25px] xl:grid-cols-4">
        <MetricStatCard
          label="Needs Attention"
          value={stats.offered}
          hint="Offered - Accept or reject in 30 seconds."
          icon={<MetricIconAlert />}
          variant="featured"
          className="dash-slide-in"
          style={{ animationDelay: "0ms" } as CSSProperties}
        />
        <MetricStatCard
          label="In Progress"
          value={stats.inProgress}
          hint={`${stats.inProgress} tasks are currently being processed for customers.`}
          icon={<MetricIconInProgress />}
          variant="plain"
          className="dash-slide-in"
          style={{ animationDelay: "60ms" } as CSSProperties}
        />
        <MetricStatCard
          label="Waiting on Customer"
          value={stats.waitingCustomer}
          hint="Waiting for customers for confirmation."
          icon={<MetricIconWaiting />}
          variant="plainCyan"
          className="dash-slide-in"
          style={{ animationDelay: "120ms" } as CSSProperties}
        />
        <MetricStatCard
          label="Completed"
          value={stats.completed}
          hint="Finished in this period."
          icon={<MetricIconCompleted />}
          variant="plainGreen"
          badge={stats.deltaBadge}
          badgeTrend={
            overview &&
            overview.completedDeltaPercent != null &&
            overview.completedDeltaPercent < 0
              ? "down"
              : "up"
          }
          className="dash-slide-in"
          style={{ animationDelay: "180ms" } as CSSProperties}
        />
      </div>

      {/* Stack until xl — sidebar + medium viewports still hit `lg` while content is narrow */}
      <div className="grid grid-cols-1 gap-4 sm:gap-[25px] xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-stretch">
        <TasksPerHourPanel className="dash-slide-in min-h-[320px] overflow-hidden sm:min-h-[380px] xl:min-h-[424px]" />
        <ShiftProgress
          completed={stats.completed}
          inProgress={stats.inProgress}
          total={stats.total}
          waiting={stats.waiting}
          progressPercent={stats.progressPct}
          rangeLabel={rangeLabel}
          onRangeChange={setRangeLabel}
          className="dash-slide-in"
        />
      </div>

      <LiveTaskQueue
        items={queueTableItems}
        rangeLabel={rangeLabel}
        onRangeChange={setRangeLabel}
      />
    </div>
  );
}
