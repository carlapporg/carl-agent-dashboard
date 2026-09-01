import type { Metadata } from "next";
import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  let waitingCustomer: Awaited<ReturnType<typeof tasksApi.list>> = [];
  let waitingPayment: Awaited<ReturnType<typeof tasksApi.list>> = [];
  let loadFailed = false;
  try {
    [waitingCustomer, waitingPayment] = await Promise.all([
      tasksApi.list({ waitingOn: "customer" }),
      tasksApi.list({ waitingOn: "payment" }),
    ]);
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <PageShell wide>
        <EmptyState
          title="Can't reach the server"
          description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
        />
      </PageShell>
    );
  }

  const items = [...waitingCustomer, ...waitingPayment]
    .filter((t) => !t.parentId || t.status === "waiting_for_customer")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  return (
    <PageShell wide>
      {items.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          description="Nothing is waiting on a customer or payment right now."
          action={
            <Link href={ROUTES.tasks}>
              <Button type="button" variant="secondary">
                Go to tasks
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-border">
            {items.map((task) => (
              <li key={task.id}>
                <Link
                  href={ROUTES.task(task.id)}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between md:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      #{task.number} {task.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {task.customerName} · {task.request}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                    <span className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-2.5 text-sm font-semibold text-accent">
                      Open
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
