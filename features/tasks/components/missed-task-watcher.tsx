"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/providers/toast-provider";
import type { Task } from "@/types/task";

/** Non-blocking notice when a server SLA expires while the list is open. */
export function MissedTaskWatcher({ tasks }: { tasks: Task[] }) {
  const { toast } = useToast();
  const toasted = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      for (const task of tasksRef.current) {
        if (task.backendStatus && task.backendStatus !== "OFFERED") continue;
        if (task.status !== "queued") continue;
        if (!task.expiresAt) continue;
        const exp = new Date(task.expiresAt).getTime();
        if (exp > now) continue;
        if (toasted.current.has(task.id)) continue;
        toasted.current.add(task.id);
        toastRef.current(`You missed a task (#${task.number})`, "info");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
