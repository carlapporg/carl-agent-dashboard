import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerRail } from "@/features/customers/components/customer-rail";
import { ItineraryPanel } from "@/features/itinerary/components/itinerary-panel";
import { TaskBriefPane } from "@/features/tasks/components/task-brief-pane";
import { TaskTree } from "@/features/tasks/components/task-tree";
import { customersApi } from "@/lib/api/customers";
import { itineraryApi } from "@/lib/api/itinerary";
import { messagesApi } from "@/lib/api/messages";
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
  } catch {
    notFound();
  }

  const parentId = task.parentId ?? task.id;
  const parent = task.parentId ? await tasksApi.get(parentId) : task;
  const children = await tasksApi.listChildren(parentId);
  const [profile, history, timeline, itinerary] = await Promise.all([
    customersApi.getProfile(task.customerId),
    customersApi.getHistory(task.customerId),
    messagesApi.list(task.id),
    itineraryApi.get(parentId),
  ]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <TaskTree
            parent={parent}
            childTasks={children}
            activeId={task.id}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <TaskBriefPane task={task} timeline={timeline} />
          {!task.parentId ? (
            <ItineraryPanel
              parent={parent}
              childTasks={children}
              itinerary={itinerary}
            />
          ) : null}
        </div>

        <CustomerRail profile={profile} history={history} />
      </div>
    </div>
  );
}
