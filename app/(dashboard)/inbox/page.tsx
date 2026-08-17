import type { Metadata } from "next";
import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  const [waitingCustomer, waitingPayment] = await Promise.all([
    tasksApi.list({ waitingOn: "customer" }),
    tasksApi.list({ waitingOn: "payment" }),
  ]);

  const items = [...waitingCustomer, ...waitingPayment]
    .filter((t) => !t.parentId || t.status === "waiting_for_customer")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Inbox
        </h1>
        <p className="mt-2 text-base text-muted md:text-lg">
          Blocked on the customer or a payment approval.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          description="Nothing is waiting on a customer or payment right now."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((task) => (
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
                    {task.customerName} · {task.request}
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
    </div>
  );
}
