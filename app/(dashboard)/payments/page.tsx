import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { dashboardApi } from "@/lib/api/dashboard";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function PaymentsOverviewPage() {
  const { pending, cards, transactions } =
    await dashboardApi.getPaymentsOverview();

  return (
    <PageShell wide>
      <PageHeader
        title="Payments"
        description="Read-only overview. Open a task to request or manage payment."
        className="mb-5 sm:mb-6"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">
            Pending approvals
          </h2>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-muted">None waiting.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pending.map((p) => (
                <li key={p.id}>
                  <Link
                    href={ROUTES.taskPanel(p.taskId, "payment")}
                    className="block rounded-lg border border-border px-3 py-2 text-sm hover:border-accent/35"
                  >
                    <p className="font-medium text-foreground">
                      ${p.amount.toFixed(0)} · {p.merchant}
                    </p>
                    <p className="text-muted">Open task →</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">
            Active virtual cards
          </h2>
          {cards.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No active cards.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={ROUTES.taskPanel(c.taskId, "payment")}
                    className="block rounded-lg border border-border px-3 py-2 text-sm hover:border-accent/35"
                  >
                    <p className="font-medium text-foreground">
                      {c.network.toUpperCase()} ···· {c.last4}
                    </p>
                    <p className="text-muted">
                      Remaining ${c.remaining.toFixed(0)} / $
                      {c.spendingLimit.toFixed(0)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">
            Needs reconciliation
          </h2>
          {transactions.filter((t) => t.needsReconcile).length === 0 ? (
            <p className="mt-3 text-sm text-muted">All clear.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {transactions
                .filter((t) => t.needsReconcile)
                .map((t) => (
                  <li key={t.id}>
                    <Link
                      href={ROUTES.taskPanel(t.taskId, "payment")}
                      className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:border-amber-300"
                    >
                      ${t.amount.toFixed(0)} · {t.merchant}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Transaction history
          </h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No transactions"
              description="Payment activity across your tasks will list here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.id}>
                <Link
                  href={ROUTES.taskPanel(t.taskId, "payment")}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-accent/[0.04]"
                >
                  <span className="font-medium text-foreground">
                    ${t.amount.toFixed(0)} · {t.merchant}
                  </span>
                  <span className="capitalize text-muted">
                    {t.status} · {new Date(t.at).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
