import { DashboardSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export default function DashboardLoading() {
  return (
    <PageShell wide>
      <DashboardSkeleton />
    </PageShell>
  );
}
