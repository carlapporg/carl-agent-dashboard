"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { MessagesSkeleton } from "@/components/feedback/skeleton";
import { MessagesView } from "@/features/messages/components/messages-view";
import { taskToConversation } from "@/lib/messages/task-to-conversation";
import { useOps } from "@/features/ops/ops-provider";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { useOpenTasks } from "@/features/tasks/hooks/use-page-queries";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";

export function MessagesPageClient() {
  const { data, isPending, isError } = useOpenTasks();
  const ops = useOps();
  const rejectedTick = useRejectedOfferTick();

  const roots = useMemo(() => {
    const seed = (data ?? []).filter((task) => !task.parentId);
    return withoutRejectedOffers(
      mergeTaskLists(seed, ops?.liveTasks ?? [], ops?.offer),
    );
  }, [data, ops?.liveTasks, ops?.offer, rejectedTick]);

  const conversations = useMemo(
    () =>
      roots
        .map(taskToConversation)
        .sort(
          (a, b) =>
            new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime(),
        ),
    [roots],
  );

  const tasks = useMemo(
    () => Object.fromEntries(roots.map((task) => [task.id, task])),
    [roots],
  );

  if (isPending && !data) {
    return <MessagesSkeleton />;
  }

  if (isError && !data) {
    return (
      <EmptyState
        title="Can't reach the server"
        description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
      />
    );
  }

  return <MessagesView conversations={conversations} tasks={tasks} />;
}
