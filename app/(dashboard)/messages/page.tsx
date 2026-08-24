import type { Metadata } from "next";
import { MessagesView } from "@/features/messages/components/messages-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { dashboardApi } from "@/lib/api/dashboard";
import { messagesApi } from "@/lib/api/messages";
import { tasksApi } from "@/lib/api/tasks";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  let conversations: Awaited<ReturnType<typeof dashboardApi.getConversations>> =
    [];
  let allTasks: Awaited<ReturnType<typeof tasksApi.list>> = [];
  try {
    [conversations, allTasks] = await Promise.all([
      dashboardApi.getConversations(),
      tasksApi.list(),
    ]);
  } catch {
    return (
      <PageShell wide>
        <PageHeader
          title="Messages"
          description="All task conversations in one place. Same chat as the workspace."
          className="mb-5 sm:mb-6"
        />
        <EmptyState
          title="Can't reach the server"
          description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
        />
      </PageShell>
    );
  }

  const timelines: Record<string, Awaited<ReturnType<typeof messagesApi.list>>> =
    {};
  await Promise.all(
    conversations.map(async (c) => {
      timelines[c.taskId] = await messagesApi.list(c.taskId).catch(() => []);
    }),
  );

  const tasks = Object.fromEntries(allTasks.map((t) => [t.id, t]));

  return (
    <PageShell wide>
      <PageHeader
        title="Messages"
        description="All task conversations in one place. Same chat as the workspace."
        className="mb-5 sm:mb-6"
      />
      <MessagesView
        conversations={conversations}
        timelines={timelines}
        tasks={tasks}
      />
    </PageShell>
  );
}
