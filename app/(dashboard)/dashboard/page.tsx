import type { Metadata } from "next";
import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { getOverviewStats, tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const [stats, tasks] = await Promise.all([
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

  const cards = [
    { label: "Needs attention", value: stats.needsAttention },
    { label: "In progress", value: stats.inProgress },
    { label: "Waiting on customer", value: stats.waitingOnCustomer },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        Overview
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
        A calm look at what needs you — then get back to handling it.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-surface p-6 md:p-7"
          >
            <p className="text-sm uppercase tracking-wide text-muted-dim">
              {card.label}
            </p>
            <p className="mt-4 text-3xl font-semibold text-foreground-soft md:text-4xl">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-medium text-foreground">Focus now</h2>
          <Link
            href={ROUTES.tasks}
            className="text-sm text-muted transition-colors hover:text-accent"
          >
            View all tasks
          </Link>
        </div>

        {focus.length === 0 ? (
          <EmptyState
            title="You're clear"
            description="No urgent work in the queue. New tasks will show up here."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {focus.map((task) => (
              <li key={task.id}>
                <Link
                  href={ROUTES.task(task.id)}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-hover/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      #{task.number} {task.title}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted">
                      {task.customerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
