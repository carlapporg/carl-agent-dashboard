"use server";

import { activityLogsApi } from "@/lib/api/activity-logs";
import { tasksApi } from "@/lib/api/tasks";

export async function getHistoryLogsAction() {
  let historyTasks: Awaited<ReturnType<typeof tasksApi.listByInbox>> = [];
  try {
    historyTasks = await tasksApi.listByInbox("HISTORY");
  } catch {
    historyTasks = [];
  }
  const roots = historyTasks.filter((task) => !task.parentId);
  return activityLogsApi.list({
    kind: "all",
    limit: 50,
    historyTasks: roots,
  });
}
