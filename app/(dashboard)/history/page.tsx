import type { Metadata } from "next";
import { HistoryPageClient } from "@/features/history/components/history-page-client";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "Activity Logs",
};

export default function HistoryPage() {
  return (
    <PageShell wide>
      <HistoryPageClient />
    </PageShell>
  );
}
