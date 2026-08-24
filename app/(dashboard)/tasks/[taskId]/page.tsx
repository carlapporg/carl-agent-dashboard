import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { customersApi } from "@/lib/api/customers";
import { itineraryApi } from "@/lib/api/itinerary";
import { messagesApi } from "@/lib/api/messages";
import { paymentsApi, receiptsApi } from "@/lib/api/payments";
import { isApiError } from "@/lib/api/errors";
import { tasksApi } from "@/lib/api/tasks";

type TaskPageProps = {
  params: Promise<{ taskId: string }>;
};

export async function generateMetadata({
  params,
}: TaskPageProps): Promise<Metadata> {
  const { taskId } = await params;
  try {
    const task = await tasksApi.get(taskId);
    return { title: `#${task.number} ${task.title}` };
  } catch {
    return { title: "Task" };
  }
}

export default async function TaskWorkspacePage({ params }: TaskPageProps) {
  const { taskId } = await params;

  let task;
  try {
    task = await tasksApi.get(taskId);
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
    notFound();
  }

  const [
    timeline,
    authorizations,
    customer,
    customerHistory,
    allTasks,
    itinerary,
    receipts,
    card,
  ] = await Promise.all([
    messagesApi.list(task.id).catch(() => []),
    paymentsApi.list(task.id).catch(() => []),
    customersApi.getProfile(task.customerId).catch(() => null),
    customersApi.getHistory(task.customerId).catch(() => []),
    tasksApi.list().catch(() => []),
    itineraryApi.get(task.id).catch(() => null),
    receiptsApi.list(task.id).catch(() => []),
    paymentsApi.getCard(task.id).catch(() => null),
  ]);

  const childTasks = allTasks.filter((t) => t.parentId === task.id);
  const parentTask = task.parentId
    ? (allTasks.find((t) => t.id === task.parentId) ?? null)
    : null;

  return (
    <PageShell>
      <Suspense fallback={<PageSkeleton />}>
        <TaskWorkspace
          task={task}
          timeline={timeline}
          authorizations={authorizations}
          customer={customer}
          customerHistory={customerHistory}
          childTasks={childTasks}
          parentTask={parentTask}
          itinerary={itinerary}
          receipts={receipts}
          card={card}
          readOnly={task.status === "completed"}
        />
      </Suspense>
    </PageShell>
  );
}
