"use client";

import Link from "next/link";
import { LiveTaskQueue } from "@/features/dashboard/components/live-task-queue";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
import { ShiftProgress } from "@/features/dashboard/components/shift-progress";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { ROUTES } from "@/lib/constants/routes";
import type { Task } from "@/types/task";

type DashboardHomeProps = {
  welcomeName: string;
  stats: {
    needsAttention: number;
    inProgress: number;
    waitingOnCustomer: number;
  };
  tasks: Task[];
};

export function DashboardHome({
  welcomeName,
  stats,
  tasks,
}: DashboardHomeProps) {
  const roots = tasks.filter((t) => !t.parentId);
  const completed = roots.filter((t) => t.status === "completed").length;
  const inProgress = roots.filter((t) => t.status === "in_progress").length;

  const urgentAttention = roots.filter(
    (t) =>
      t.priority === "urgent" &&
      (t.status === "queued" ||
        t.status === "waiting_for_payment" ||
        t.status === "in_progress"),
  ).length;

  const firstName = welcomeName.split(" ")[0] || welcomeName;

  return (
    <PageShell wide>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Live queue below, progress up top — grab what’s next and keep Carl’s promise: It’s handled."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={ROUTES.tasks}>
              <Button type="button" variant="secondary">
                View tasks
              </Button>
            </Link>
            <Link href={ROUTES.inbox}>
              <Button
                type="button"
                className="border-0 bg-gradient-to-r from-[#7c6cff] to-[#4f7cff] text-white hover:opacity-95"
              >
                Open inbox
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricStatCard
          label="Needs attention"
          value={stats.needsAttention}
          ringValue={urgentAttention || (stats.needsAttention > 0 ? 1 : 0)}
          hint="Queued, urgent, or waiting on payment"
          color="#ef4444"
        />
        <MetricStatCard
          label="In progress"
          value={stats.inProgress}
          ringValue={Math.min(stats.inProgress, 1)}
          hint="Actively being handled"
          color="#4f7cff"
        />
        <MetricStatCard
          label="Waiting on customer"
          value={stats.waitingOnCustomer}
          ringValue={stats.waitingOnCustomer}
          hint="Blocked until they reply"
          color="#9ca3af"
        />
      </div>

      <div className="mt-8">
        <ShiftProgress
          completed={completed}
          inProgress={inProgress}
          total={Math.max(roots.length, 1)}
        />
      </div>

      <div className="mt-10">
        <LiveTaskQueue seedTasks={tasks} />
      </div>
    </PageShell>
  );
}
