"use client";

import { DashboardHome } from "@/features/dashboard/components/dashboard-home";
import { DashboardSkeleton } from "@/components/feedback/skeleton";
import { useDashboardSeedTasks } from "@/features/tasks/hooks/use-page-queries";

export function DashboardPageClient({ welcomeName }: { welcomeName: string }) {
  const { data, isPending } = useDashboardSeedTasks();

  if (isPending && !data) {
    return <DashboardSkeleton />;
  }

  return <DashboardHome welcomeName={welcomeName} tasks={data ?? []} />;
}
