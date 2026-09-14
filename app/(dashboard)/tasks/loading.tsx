import { TasksSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export default function TasksLoading() {
  return (
    <PageShell wide>
      <TasksSkeleton />
    </PageShell>
  );
}
