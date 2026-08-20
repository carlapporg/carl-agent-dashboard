import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskList } from "@/features/tasks/components/task-list";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  const tasks = await tasksApi.list();
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
