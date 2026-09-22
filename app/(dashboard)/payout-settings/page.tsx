import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { PayoutSettingsView } from "@/features/payout-settings/components/payout-settings-view";

export const metadata: Metadata = {
  title: "Payout Settings",
};

export default function PayoutSettingsPage() {
  return (
    <PageShell wide>
      <Suspense
        fallback={
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8 text-sm text-muted shadow-[var(--shadow-card)]">
            Loading payout settings…
          </div>
        }
      >
        <PayoutSettingsView />
      </Suspense>
    </PageShell>
  );
}
