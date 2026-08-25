"use client";

import Link from "next/link";
import { useEffect, useMemo, type CSSProperties } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
import { ShiftProgress } from "@/features/dashboard/components/shift-progress";
import { WsConnectionBanner } from "@/features/dashboard/components/ws-connection-banner";
import { useOps } from "@/features/ops/ops-provider";
import { hasStartedWork } from "@/features/tasks/lib/workflow";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { ROUTES } from "@/lib/constants/routes";
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  tasks: Task[];
  presence?: AgentPresence;
};

export function DashboardHome({
  welcomeName,
  tasks,
  presence,
}: DashboardHomeProps) {
  const ops = useOps();
  const firstName = welcomeName.split(" ")[0] || welcomeName;

  const roots = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);

  useEffect(() => {
    if (presence) {
      ops?.setPresence(presence);
    }
  }, [ops, presence]);

  const stats = useMemo(() => {
    const offered = roots.filter((t) => t.backendStatus === "OFFERED").length;
    const inProgress = roots.filter(
      (t) => t.backendStatus === "IN_PROGRESS",
    ).length;
    const waitingCustomer = roots.filter(
      (t) => t.backendStatus === "WAITING_FOR_USER",
    ).length;
    const completed = roots.filter((t) => t.status === "completed").length;
    const inMotion = roots.filter((t) => hasStartedWork(t)).length;
    const total = Math.max(roots.length, 1);
    const activeCount = roots.filter(
      (t) =>
        hasStartedWork(t) ||
        t.backendStatus === "OFFERED" ||
        t.backendStatus === "ASSIGNED",
    ).length;

    return {
      offered,
      inProgress,
      waitingCustomer,
      completed,
      inMotion,
      total,
      activeCount,
    };
  }, [roots]);

  return (
    <PageShell wide>
      <WsConnectionBanner />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <AvailabilityToggle
          activeTaskCount={stats.activeCount}
          presence={presence}
        />
      </div>

      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Live assignments, timers, and queue — all driven by Nest."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={ROUTES.tasks}>
              <Button type="button" variant="secondary">
                View tasks
              </Button>
            </Link>
            <Link href={ROUTES.messages}>
              <Button type="button">Open inbox</Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Needs attention"
            value={stats.offered}
            ringValue={stats.offered}
            hint="OFFERED — accept or reject in 30 seconds."
            color="#ef4444"
            className="dash-slide-in"
          />
          <MetricStatCard
            label="In progress"
            value={stats.inProgress}
            ringValue={stats.inProgress}
            hint="Started work in motion."
            color="#4f7cff"
            className="dash-slide-in"
            style={{ animationDelay: "60ms" } as CSSProperties}
          />
          <MetricStatCard
            label="Waiting on customer"
            value={stats.waitingCustomer}
            ringValue={stats.waitingCustomer}
            hint="WAITING_FOR_USER from Nest."
            color="#d97706"
            className="dash-slide-in"
            style={{ animationDelay: "120ms" } as CSSProperties}
          />
          <MetricStatCard
            label="Completed"
            value={stats.completed}
            ringValue={stats.completed}
            hint="Finished in this list."
            color="#059669"
            className="dash-slide-in"
            style={{ animationDelay: "180ms" } as CSSProperties}
          />
        </div>

        <ShiftProgress
          completed={stats.completed}
          inProgress={stats.inMotion}
          total={stats.total}
          className="dash-slide-in"
        />

        <LiveTaskQueue seedTasks={roots} />
      </div>
    </PageShell>
  );
}
