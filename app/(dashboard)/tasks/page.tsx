import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskList } from "@/features/tasks/components/task-list";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskStatus } from "@/types/task";

export const metadata: Metadata = {
  title: "Tasks",
};

type TasksPageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const status = (params.status as TaskStatus | "all" | undefined) ?? "all";
  const search = params.q ?? "";

  const tasks = await tasksApi.list({
    status,
    search,
  });

  const roots = tasks.filter((t) => !t.parentId);

  return (
    <PageShell wide>
      <PageHeader
        title="Tasks"
        description="Pick the next request, open the workspace, and keep customers moving."
      />
      <Suspense fallback={<PageSkeleton />}>
        <TaskList tasks={roots} />
      </Suspense>
    </PageShell>
  );
}
