import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskList } from "@/features/tasks/components/task-list";
import { PageSkeleton } from "@/components/feedback/skeleton";
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
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Tasks
        </h1>
        <p className="mt-2 text-base text-muted md:text-lg">
          What needs you now — accept, execute, and close the loop.
        </p>
      </header>

      <Suspense fallback={<PageSkeleton />}>
        <TaskList tasks={roots} />
      </Suspense>
    </div>
  );
}
