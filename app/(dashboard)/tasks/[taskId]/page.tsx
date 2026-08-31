import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { EmptyState } from "@/components/feedback/empty-state";
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
import {
  isConfirmationConfirmed,
  shouldFetchTaskConfirmation,
} from "@/types/confirmation";

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

export default async function TaskWorkspacePage({ params }: TaskPageProps) {
  const { taskId } = await params;

  let task;
  try {
    task = await getTaskCached(taskId);
  } catch (error) {
    if (isApiError(error) && error.kind === "network") {
      return (
        <PageShell>
          <EmptyState
            title="Can't reach the server"
            description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
          />
        </PageShell>
      );
    }
    if (isApiError(error) && (error.status === 403 || error.status === 404)) {
      redirect(ROUTES.tasks);
    }
    notFound();
  }

  if (task.backendStatus === "REJECTED") {
    redirect(ROUTES.tasks);
  }

  const timeline = await listTaskMessagesCached(task.id).catch(() => []);
  const shouldFetch = shouldFetchTaskConfirmation(task.backendStatus);
  const confirmation = shouldFetch
    ? await getTaskConfirmationCached(task.id).catch(() => null)
    : null;
  const receipt = isConfirmationConfirmed(confirmation)
    ? await getTaskReceiptCached(task.id).catch(() => null)
    : null;

  return (
    <PageShell>
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
    </PageShell>
  );
}
