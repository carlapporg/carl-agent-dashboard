import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryPageClient } from "@/features/history/components/history-page-client";
import { HistorySkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "Activity Logs",
};

export default function HistoryPage() {
  return (
    <PageShell wide>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryPageClient />
      </Suspense>
    </PageShell>
  );
}
