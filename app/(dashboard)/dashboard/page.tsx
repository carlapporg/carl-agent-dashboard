import type { Metadata } from "next";
import { DashboardHome } from "@/features/dashboard/components/dashboard-home";
import { getSession } from "@/lib/auth/session";
import { getOverviewStats, tasksApi } from "@/lib/api/tasks";
import { getAgentDisplayName } from "@/types/user";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const [session, stats, tasks] = await Promise.all([
    getSession(),
    getOverviewStats(),
    tasksApi.list(),
  ]);

  const welcomeName = session
    ? getAgentDisplayName(session.user)
    : "there";

  return (
    <DashboardHome
      welcomeName={welcomeName}
      stats={stats}
      tasks={tasks}
    />
  );
}
