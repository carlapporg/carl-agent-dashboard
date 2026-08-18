import type { Metadata } from "next";
import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { StatCard } from "@/components/ui/stat-card";
import { getSession } from "@/lib/auth/session";
import { getOverviewStats, tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";
import { getAgentDisplayName } from "@/types/user";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const [session, stats, tasks] = await Promise.all([
    getSession(),
    getOverviewStats(),
    tasksApi.list(),
  ]);

  const focus = tasks
    .filter((t) => !t.parentId)
    .filter(
      (t) =>
        t.status === "queued" ||
        t.status === "in_progress" ||
        t.status === "waiting_for_payment" ||
        t.status === "waiting_for_customer" ||
        t.priority === "urgent",
    )
    .slice(0, 5);

  const recent = [...tasks]
    .filter((t) => !t.parentId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4);

  const welcomeName = session
    ? getAgentDisplayName(session.user)
    : "there";

  return (
    <PageShell wide>
      <PageHeader
        title={`Welcome back, ${welcomeName}`}
        description="Here’s what needs attention — start with Focus now, then clear the rest."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={ROUTES.tasks}>
              <Button type="button" variant="secondary">
                View tasks
              </Button>
            </Link>
            <Link href={ROUTES.inbox}>
              <Button type="button">Open inbox</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Needs attention"
          value={stats.needsAttention}
          hint="Queued, urgent, or waiting on payment"
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          hint="Actively being handled"
        />
        <StatCard
          label="Waiting on customer"
          value={stats.waitingOnCustomer}
          hint="Blocked until they reply"
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Focus now</h2>
          <Link
            href={ROUTES.tasks}
            className="text-base font-semibold text-accent hover:text-accent-hover"
          >
            View all
          </Link>
        </div>

        {focus.length === 0 ? (
          <EmptyState
            title="You're clear"
            description="No urgent work in the queue. New tasks will show up here."
            action={
              <Link href={ROUTES.tasks}>
                <Button type="button" variant="secondary">
                  Browse all tasks
                </Button>
              </Link>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {focus.map((task) => (
                <li key={task.id}>
                  <Link
                    href={ROUTES.task(task.id)}
                    className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-accent/[0.04] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground">
                        #{task.number} {task.title}
                      </p>
                      <p className="mt-1 truncate text-base text-muted">
                        {task.customerName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      <span className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold text-accent">
                        Open
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Recent updates
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="When tasks move, you’ll see the latest updates here."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {recent.map((task) => (
                <li key={task.id}>
                  <Link
                    href={ROUTES.task(task.id)}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-accent/[0.04]"
                  >
                    <span className="truncate text-base font-semibold text-foreground">
                      #{task.number} {task.title}
                    </span>
                    <StatusBadge status={task.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
