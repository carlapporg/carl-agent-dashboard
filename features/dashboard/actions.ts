"use server";

import { unstable_noStore as noStore } from "next/cache";
import { dashboardAnalyticsApi } from "@/lib/api/dashboard-analytics";
import { dashboardApi } from "@/lib/api/dashboard";
import type { DashboardRange } from "@/lib/dashboard/range";
import { tasksApi } from "@/lib/api/tasks";

export async function getQueuePreviewAction(limit = 3) {
  return dashboardApi.getQueuePreview(limit);
}

export async function getOpenTasksAction() {
  return tasksApi.listOpen();
}

export async function getActiveTasksAction() {
  return dashboardApi.getActiveTasks();
}

export async function getAlertsAction() {
  return dashboardApi.getAlerts();
}

export async function getQuickStatsAction() {
  return dashboardApi.getQuickStats();
}

export async function getAgentPreferencesAction() {
  return dashboardApi.getAgentPreferences();
}

export async function getAgentMetricsAction() {
  return dashboardApi.getAgentMetrics();
}

export async function getDashboardOverviewAction(
  range: DashboardRange = "this_month",
) {
  noStore();
  return dashboardAnalyticsApi.getOverview(range);
}

export async function getTasksPerHourAction(range: DashboardRange = "today") {
  noStore();
  return dashboardAnalyticsApi.getTasksPerHour(range);
}

/** Open + history tasks for client-side completed / in-progress chart split. */
export async function getTasksPerDaySplitAction() {
  noStore();
  const [active, history] = await Promise.all([
    tasksApi.listByInbox("ACTIVE").catch(() => []),
    tasksApi.listByInbox("HISTORY").catch(() => []),
  ]);
  return { active, history };
}
