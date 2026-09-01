import type { Metadata } from "next";
import { HistoryView } from "@/features/history/components/history-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { activityLogsApi } from "@/lib/api/activity-logs";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Activity Logs",
};

export default async function HistoryPage() {
  let historyTasks: Awaited<ReturnType<typeof tasksApi.listByInbox>> = [];
  try {
    historyTasks = await tasksApi.listByInbox("HISTORY");
  } catch {
    historyTasks = [];
  }

  try {
    const roots = historyTasks.filter((t) => !t.parentId);
    const logs = await activityLogsApi.list(roots);
    return (
      <PageShell wide>
        <HistoryView logs={logs} />
      </PageShell>
    );
  } catch {
    return (
      <PageShell wide>
        <EmptyState
          title="Can't load activity"
          description="Your login is still saved. Refresh the page and try again."
        />
      </PageShell>
    );
  }
}
