import type { Metadata } from "next";
import { HistoryView } from "@/features/history/components/history-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "History",
};

export default async function HistoryPage() {
  let tasks: Awaited<ReturnType<typeof tasksApi.listByInbox>> | null = null;
  try {
    tasks = await tasksApi.listByInbox("HISTORY");
  } catch {
    tasks = null;
  }

  if (!tasks) {
    return (
      <PageShell wide>
        <PageHeader
          title="History"
          description="Completed and failed tasks. Open one to review or message the client."
          className="mb-5 sm:mb-6"
        />
        <EmptyState
          title="Can't reach the server"
          description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
        />
      </PageShell>
    );
  }

  const roots = tasks.filter((t) => !t.parentId);

  return (
    <PageShell wide>
      <PageHeader
        title="History"
        description="Completed and failed tasks. Open one to review or message the client."
        className="mb-5 sm:mb-6"
      />
      <HistoryView tasks={roots} />
    </PageShell>
  );
}
