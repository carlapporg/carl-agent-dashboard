"use client";

import { EmptyState } from "@/components/feedback/empty-state";
import { HistorySkeleton } from "@/components/feedback/skeleton";
import { HistoryView } from "@/features/history/components/history-view";
import { useHistoryLogs } from "@/features/tasks/hooks/use-page-queries";

export function HistoryPageClient() {
  const { data, isPending, isError } = useHistoryLogs();

  if (isPending && !data) {
    return <HistorySkeleton />;
  }

  if (isError && !data) {
    return (
      <EmptyState
        title="Can't load activity"
        description="Your login is still saved. Refresh the page and try again."
      />
    );
  }

  return <HistoryView logs={data ?? []} />;
}
