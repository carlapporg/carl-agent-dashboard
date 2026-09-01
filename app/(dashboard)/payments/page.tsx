import type { Metadata } from "next";
import { PaymentsOverviewView } from "@/features/payments/components/payments-overview-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { paymentsOverviewApi } from "@/lib/api/payments-overview";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function PaymentsOverviewPage() {
  try {
    const [summary, transactions] = await Promise.all([
      paymentsOverviewApi.getSummary(),
      paymentsOverviewApi.getTransactions(),
    ]);

    return (
      <PageShell wide>
        <PaymentsOverviewView
          summary={summary}
          transactions={transactions}
        />
      </PageShell>
    );
  } catch {
    return (
      <PageShell wide>
        <EmptyState
          title="Can't load payments"
          description="Your login is still saved. Refresh the page and try again."
        />
      </PageShell>
    );
  }
}
