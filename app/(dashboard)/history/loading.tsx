import { HistorySkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export default function HistoryLoading() {
  return (
    <PageShell wide>
      <HistorySkeleton />
    </PageShell>
  );
}
