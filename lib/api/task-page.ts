import { cache } from "react";
import { confirmationApi } from "@/lib/api/confirmation";
import { messagesApi } from "@/lib/api/messages";
import { tasksApi } from "@/lib/api/tasks";

/** One Nest GET per task per server request (metadata + page share this). */
export const getTaskCached = cache((taskId: string) => tasksApi.get(taskId));

export const listTaskMessagesCached = cache((taskId: string) =>
  messagesApi.list(taskId),
);

export const getTaskConfirmationCached = cache((taskId: string) =>
  confirmationApi.get(taskId),
);
