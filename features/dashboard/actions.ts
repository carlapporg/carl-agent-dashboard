"use server";

import { dashboardApi } from "@/lib/api/dashboard";

export async function getQueuePreviewAction(limit = 3) {
  return dashboardApi.getQueuePreview(limit);
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
