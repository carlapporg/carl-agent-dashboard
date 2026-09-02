import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { isApiError } from "@/lib/api/errors";
import { isClosedTask } from "@/features/tasks/lib/workflow";
import { ROUTES } from "@/lib/constants/routes";
import {
  getTaskCached,
  getTaskConfirmationCached,
  getTaskReceiptCached,
  listTaskMessagesCached,
} from "@/lib/api/task-page";
import { tasksApi } from "@/lib/api/tasks";
import { shouldFetchTaskConfirmation } from "@/types/confirmation";
import { shouldFetchTaskReceipt } from "@/types/receipt";
import type { Task } from "@/types/task";

type TaskPageProps = {
  params: Promise<{ taskId: string }>;
};

export async function generateMetadata({
  params,
}: TaskPageProps): Promise<Metadata> {
  const { taskId } = await params;
  try {
    const task = await getTaskCached(taskId);
    return { title: `#${task.number} ${task.title}` };
  } catch {
    return { title: "Task" };
  }
}

async function resolveTask(taskId: string): Promise<Task | null> {
  try {
    return await getTaskCached(taskId);
  } catch (error) {
    if (!isApiError(error) || (error.status !== 403 && error.status !== 404)) {
      throw error;
    }
    const open = await tasksApi.listOpen().catch(() => [] as Task[]);
    return open.find((row) => row.id === taskId) ?? null;
  }
}

function taskUnavailableView(description: string) {
  return (
    <PageShell wide>
      <EmptyState
        title="Task unavailable"
        description={description}
        action={
          <Link href={ROUTES.tasks}>
            <Button type="button" variant="secondary">
              Back to tasks
            </Button>
          </Link>
        }
      />
    </PageShell>
  );
}

export default async function TaskWorkspacePage({ params }: TaskPageProps) {
  const { taskId } = await params;

  let task: Task | null;
  try {
    task = await resolveTask(taskId);
  } catch (error) {
    if (isApiError(error) && error.kind === "network") {
      return (
        <PageShell wide>
          <EmptyState
            title="Can't reach the server"
            description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
          />
        </PageShell>
      );
    }
    notFound();
  }

  if (!task) {
    return taskUnavailableView(
      "This task may have been reassigned, expired, or removed from your queue.",
    );
  }

  if (task.backendStatus === "REJECTED") {
    return taskUnavailableView(
      "You rejected this offer. It has been returned to the queue for another agent.",
    );
  }

  const timeline = await listTaskMessagesCached(task.id).catch(() => []);

  // Task Details Confirmation — GET only when Nest status implies one exists.
  // Never probe on fresh IN_PROGRESS (404 Confirmation not found).
  const confirmation = shouldFetchTaskConfirmation(task.backendStatus)
    ? await getTaskConfirmationCached(task.id).catch(() => null)
    : null;

  // Document upload — separate endpoint; only after details CONFIRMED.
  const receipt = shouldFetchTaskReceipt(
    confirmation?.status,
    task.backendStatus,
  )
    ? await getTaskReceiptCached(task.id).catch(() => null)
    : null;

  return (
    <PageShell wide>
      <Suspense fallback={<PageSkeleton />}>
        <TaskWorkspace
          task={task}
          timeline={timeline}
          confirmation={confirmation}
          receipt={receipt}
          customer={null}
          customerHistory={[]}
          childTasks={[]}
          parentTask={null}
          itinerary={null}
          readOnly={isClosedTask(task)}
        />
      </Suspense>
    </PageShell>
  );
}
