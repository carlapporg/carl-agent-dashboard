import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskList } from "@/features/tasks/components/task-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  let tasks: Awaited<ReturnType<typeof tasksApi.list>> | null = null;
  try {
    tasks = await tasksApi.list();
  } catch {
    tasks = null;
  }

  if (!tasks) {
    return (
      <PageShell wide>
        <PageHeader
          title="Tasks"
          description="Accept a first offer, or open an assigned task and Start."
          className="mb-5 sm:mb-6"
        />
        <EmptyState
          title="Can't load tasks"
          description="Your login is still saved. Refresh the page. If this keeps happening, sign out and sign in again."
        />
      </PageShell>
    );
  }

  const roots = tasks.filter((t) => !t.parentId);

  return (
    <PageShell wide>
      <PageHeader
        title="Tasks"
        description="Accept a first offer, or open an assigned task and Start."
        className="mb-5 sm:mb-6"
      />
      <Suspense fallback={<PageSkeleton />}>
        <TaskList tasks={roots} />
      </Suspense>
    </PageShell>
  );
}
