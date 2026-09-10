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

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!ops?.queuePulse) return;
    const id = window.setTimeout(() => {
      void loadOverview();
    }, 400);
    return () => window.clearTimeout(id);
  }, [ops?.queuePulse, loadOverview]);

  const roots = useMemo(() => {
    const merged = mergeTaskLists(
      tasks.filter((t) => !t.parentId),
      ops?.liveTasks ?? [],
      ops?.offer,
    );
    return withoutRejectedOffers(merged);
  }, [tasks, ops?.liveTasks, ops?.offer, ops?.queuePulse, rejectedTick]);

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
    () => bucketLiveQueueTasks(liveQueueItems),
    [liveQueueItems],
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

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
            Sales Overview
          </h1>
          <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-muted">
            Your current sales summary and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AvailabilityToggle activeTaskCount={stats.activeTaskCount} />
          <MonthFilterPill value={rangeLabel} onChange={setRangeLabel} />
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
          hint="Finished in this period."
          icon={<MetricIcon src="/figma/dashboard/check-square-02.svg" />}
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

      <div className="grid gap-[25px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-stretch">
        <TasksPerHourPanel className="dash-slide-in min-h-[424px]" />
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
