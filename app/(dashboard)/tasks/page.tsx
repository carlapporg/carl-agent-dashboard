import type { Metadata } from "next";
import { TasksPageClient } from "@/features/tasks/components/tasks-page-client";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "Task Hub",
};

export default function TasksPage() {
  return (
    <PageShell wide>
      <TasksPageClient />
    </PageShell>
  );
}
