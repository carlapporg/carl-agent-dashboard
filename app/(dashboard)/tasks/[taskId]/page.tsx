import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskBriefPane } from "@/features/tasks/components/task-brief-pane";
import { PageShell } from "@/components/ui/page-shell";
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

  const timeline = await messagesApi.list(task.id);

  return (
    <PageShell>
      <TaskBriefPane task={task} timeline={timeline} />
    </PageShell>
  );
}
