import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { EarningsView } from "@/features/earnings/components/earnings-view";

export const metadata: Metadata = {
  title: "Earnings",
};

export default function EarningsPage() {
  return (
    <PageShell wide>
      <EarningsView />
    </PageShell>
  );
}
