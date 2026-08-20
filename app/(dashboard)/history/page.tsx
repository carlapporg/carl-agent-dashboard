import type { Metadata } from "next";
import { HistoryView } from "@/features/history/components/history-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "History",
};

export default async function HistoryPage() {
  const tasks = await tasksApi.list({ status: "completed" });
  const roots = tasks.filter((t) => !t.parentId);

  return (
    <PageShell wide>
      <PageHeader
        title="History"
        description="Completed tasks (read-only). Reopen is planned for a later release."
        className="mb-5 sm:mb-6"
      />
      <HistoryView tasks={roots} />
    </PageShell>
  );
}
