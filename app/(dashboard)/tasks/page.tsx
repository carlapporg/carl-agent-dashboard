import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskList } from "@/features/tasks/components/task-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { TasksSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Task Hub",
};

async function TasksContent() {
  let tasks: Awaited<ReturnType<typeof tasksApi.list>> | null = null;
  try {
    tasks = await tasksApi.list();
  } catch {
    tasks = null;
  }

  if (!tasks) {
    return (
      <EmptyState
        title="Can't load tasks"
        description="Your login is still saved. Refresh the page. If this keeps happening, sign out and sign in again."
      />
    );
  }

  const roots = tasks.filter((t) => !t.parentId);
  return <TaskList tasks={roots} />;
}

export default function TasksPage() {
  return (
    <PageShell wide>
      <Suspense fallback={<TasksSkeleton />}>
        <TasksContent />
      </Suspense>
    </PageShell>
  );
}
