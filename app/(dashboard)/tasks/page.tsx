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
          description="Assigned work appears here automatically. Open a task to start — no accept needed."
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
        title="Tasks"
        description="Assigned work appears here automatically. Open a task to start — no accept needed."
        className="mb-5 sm:mb-6"
      />
      <Suspense fallback={<PageSkeleton />}>
        <TaskList tasks={roots} />
      </Suspense>
    </PageShell>
  );
}
