import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardHome } from "@/features/dashboard/components/dashboard-home";
import { DashboardSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { getSession } from "@/lib/auth/session";
import { tasksApi } from "@/lib/api/tasks";
import { getAgentDisplayName } from "@/types/user";

export const metadata: Metadata = {
  title: "Overview",
};

async function DashboardContent() {
  const session = await getSession();
  const welcomeName = session ? getAgentDisplayName(session.user) : "there";

  const [offered, active, history] = await Promise.all([
    tasksApi.listByInbox("OFFERED").catch(() => []),
    tasksApi.listByInbox("ACTIVE").catch(() => []),
    tasksApi.listByInbox("HISTORY").catch(() => []),
  ]);

  const tasks = [...offered, ...active, ...history];

  return <DashboardHome welcomeName={welcomeName} tasks={tasks} />;
}

export default function DashboardPage() {
  return (
    <PageShell wide>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageShell>
  );
}
