"use server";

import { dashboardApi } from "@/lib/api/dashboard";
import { tasksApi } from "@/lib/api/tasks";

export async function getQueuePreviewAction(limit = 3) {
  return dashboardApi.getQueuePreview(limit);
}

export async function getOpenTasksAction() {
  try {
    return await tasksApi.listOpen();
  } catch {
    return [];
  }
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
