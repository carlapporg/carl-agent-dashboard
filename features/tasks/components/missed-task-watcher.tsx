"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/providers/toast-provider";
import type { Task } from "@/types/task";

/** Notice when a started task's SLA expires. Offers auto-assign instead. */
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
        if (task.backendStatus === "OFFERED" || task.status === "queued") continue;
        if (!task.expiresAt) continue;
        const exp = new Date(task.expiresAt).getTime();
        if (exp > now) continue;
        if (toasted.current.has(task.id)) continue;
        toasted.current.add(task.id);
        toastRef.current(`SLA ended on #${task.number}`, "info");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
