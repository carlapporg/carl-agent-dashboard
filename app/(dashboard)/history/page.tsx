import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryView } from "@/features/history/components/history-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { HistorySkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { activityLogsApi } from "@/lib/api/activity-logs";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Activity Logs",
};

async function HistoryContent() {
  let historyTasks: Awaited<ReturnType<typeof tasksApi.listByInbox>> = [];
  try {
    historyTasks = await tasksApi.listByInbox("HISTORY");
  } catch {
    historyTasks = [];
  }

  try {
    const roots = historyTasks.filter((t) => !t.parentId);
    const logs = await activityLogsApi.list({
      kind: "all",
      limit: 50,
      historyTasks: roots,
    });
    return <HistoryView logs={logs} />;
  } catch {
    return (
      <EmptyState
        title="Can't load activity"
        description="Your login is still saved. Refresh the page and try again."
      />
    );
  }
}

export default function HistoryPage() {
  return (
    <PageShell wide>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryContent />
      </Suspense>
    </PageShell>
  );
}
