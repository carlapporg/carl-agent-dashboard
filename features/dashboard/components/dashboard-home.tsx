"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
import { ShiftProgress } from "@/features/dashboard/components/shift-progress";
import { WsConnectionBanner } from "@/features/dashboard/components/ws-connection-banner";
import { hasStartedWork } from "@/features/tasks/lib/workflow";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { ROUTES } from "@/lib/constants/routes";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  tasks: Task[];
};

export function DashboardHome({ welcomeName, tasks }: DashboardHomeProps) {
  const firstName = welcomeName.split(" ")[0] || welcomeName;

  const roots = useMemo(
    () => tasks.filter((t) => !t.parentId),
    [tasks],
  );

  const stats = useMemo(() => {
    const needsAttention = roots.filter(
      (t) =>
        t.status === "queued" ||
        t.status === "assigned" ||
        t.status === "waiting_for_payment" ||
        t.priority === "urgent",
    ).length;
    const inProgress = roots.filter((t) => t.status === "in_progress").length;
    const waitingCustomer = roots.filter(
      (t) => t.status === "waiting_for_customer",
    ).length;
    const completed = roots.filter((t) => t.status === "completed").length;
    const inMotion = roots.filter((t) => hasStartedWork(t)).length;
    const total = Math.max(roots.length, 1);
    const activeCount = roots.filter((t) => hasStartedWork(t)).length;

    return {
      needsAttention,
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <AvailabilityToggle activeTaskCount={stats.activeCount} />
      </div>

      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here’s your shift at a glance — metrics, progress, and the live queue."
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

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricStatCard
            label="Needs attention"
            value={stats.needsAttention}
            ringValue={stats.needsAttention}
            hint="Queued, urgent, or waiting on payment."
            color="#ef4444"
            className="dash-slide-in"
          />
          <MetricStatCard
            label="In progress"
            value={stats.inProgress}
            ringValue={stats.inProgress}
            hint="Actively being handled."
            color="#4f7cff"
            className="dash-slide-in"
            style={{ animationDelay: "60ms" } as CSSProperties}
          />
          <MetricStatCard
            label="Waiting on customer"
            value={stats.waitingCustomer}
            ringValue={stats.waitingCustomer}
            hint="Blocked until they reply."
            color="#94a3b8"
            className="dash-slide-in"
            style={{ animationDelay: "120ms" } as CSSProperties}
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
