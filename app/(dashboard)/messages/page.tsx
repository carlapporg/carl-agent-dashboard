import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesView } from "@/features/messages/components/messages-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { MessagesSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { taskToConversation } from "@/lib/api/dashboard";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Chat Box",
};

async function MessagesContent() {
  let openTasks: Awaited<ReturnType<typeof tasksApi.listOpen>> = [];
  try {
    openTasks = await tasksApi.listOpen();
  } catch {
    return (
      <EmptyState
        title="Can't reach the server"
        description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
      />
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

  return <MessagesView conversations={conversations} tasks={tasks} />;
}

export default function MessagesPage() {
  return (
    <PageShell wide className="max-w-none">
      <Suspense fallback={<MessagesSkeleton />}>
        <MessagesContent />
      </Suspense>
    </PageShell>
  );
}
