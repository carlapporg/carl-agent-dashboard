"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/providers/toast-provider";
import type { Task } from "@/types/task";

/** Non-blocking notice when a server SLA expires while the list is open. */
export function MissedTaskWatcher({ tasks }: { tasks: Task[] }) {
  const { toast } = useToast();
  const toasted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      for (const task of tasks) {
        if (task.backendStatus && task.backendStatus !== "OFFERED") continue;
        if (task.status !== "queued") continue;
        if (!task.expiresAt) continue;
        const exp = new Date(task.expiresAt).getTime();
        if (exp > now) continue;
        if (toasted.current.has(task.id)) continue;
        toasted.current.add(task.id);
        toast(`You missed a task (#${task.number})`, "info");
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [tasks, toast]);

  return null;
}
