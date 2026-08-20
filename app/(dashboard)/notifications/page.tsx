import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { dashboardApi } from "@/lib/api/dashboard";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const items = await dashboardApi.getNotifications();

  return (
    <PageShell wide>
      <PageHeader
        title="Notifications"
        description="Same events as the dashboard alerts strip — chronologically."
        className="mb-5 sm:mb-6"
      />

      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Payment results, SLA warnings, and escalations land here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const href =
                n.taskId && n.panel
                  ? ROUTES.taskPanel(n.taskId, n.panel)
                  : n.taskId
                    ? ROUTES.task(n.taskId)
                    : null;
              const inner = (
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {n.title}
                    </p>
                    <time className="text-xs tabular-nums text-muted">
                      {new Date(n.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-muted">{n.body}</p>
                  {href ? (
                    <p className="mt-1.5 text-sm font-semibold text-accent">
                      Go to task →
                    </p>
                  ) : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="block transition-colors hover:bg-accent/[0.04]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}
