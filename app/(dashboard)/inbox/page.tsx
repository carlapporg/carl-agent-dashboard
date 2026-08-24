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
        <PageHeader
          title="Inbox"
          description="Blocked on the customer or a payment approval — these need a nudge or follow-up."
        />
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
      <PageHeader
        title="Inbox"
        description="Blocked on the customer or a payment approval — these need a nudge or follow-up."
      />

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
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {items.map((task) => (
              <li key={task.id}>
                <Link
                  href={ROUTES.task(task.id)}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-accent/[0.04] sm:flex-row sm:items-center sm:justify-between"
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
                    <span className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-semibold text-accent">
                      Open
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}
