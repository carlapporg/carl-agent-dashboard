import type { Metadata } from "next";
import { MessagesView } from "@/features/messages/components/messages-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { taskToConversation } from "@/lib/api/dashboard";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Agent Chat",
};

export default async function MessagesPage() {
  let openTasks: Awaited<ReturnType<typeof tasksApi.listOpen>> = [];
  try {
    openTasks = await tasksApi.listOpen();
  } catch {
    return (
      <PageShell wide>
        <EmptyState
          title="Can't reach the server"
          description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
        />
      </PageShell>
    );
  }

  const roots = openTasks.filter((task) => !task.parentId);
  const conversations = roots
    .map(taskToConversation)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
  const tasks = Object.fromEntries(roots.map((task) => [task.id, task]));

  return (
    <PageShell wide>
      <MessagesView conversations={conversations} tasks={tasks} />
    </PageShell>
  );
}
