"use client";

import { EmptyState } from "@/components/feedback/empty-state";
import { TasksSkeleton } from "@/components/feedback/skeleton";
import { TaskList } from "@/features/tasks/components/task-list";
import { useTaskHubTasks } from "@/features/tasks/hooks/use-page-queries";

export function TasksPageClient() {
  const { data, isPending, isError } = useTaskHubTasks();

  if (isPending && !data) {
    return <TasksSkeleton />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Can't load tasks"
        description="Your login is still saved. Refresh the page. If this keeps happening, sign out and sign in again."
      />
    );
  }

  const roots = data.filter((task) => !task.parentId);
  return <TaskList tasks={roots} />;
}
