"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { getAlertsAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/lib/constants/routes";
import type { AgentAlert } from "@/types/dashboard";

export function AlertsStrip() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);

  useEffect(() => {
    void getAlertsAction().then(setAlerts);
  }, []);

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast("Alert dismissed", "info");
  }

  function snooze(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast("Alert snoozed", "info");
  }

  if (alerts.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50/50 p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Action required
      </h2>
      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => {
          const href =
            alert.taskId && alert.panel
              ? ROUTES.taskPanel(alert.taskId, alert.panel)
              : alert.taskId
                ? ROUTES.task(alert.taskId)
                : ROUTES.notifications;
          return (
            <li
              key={alert.id}
              className="rounded-lg border border-border bg-surface px-3 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {alert.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{alert.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={href}>
                  <Button type="button" className="h-8 px-3 text-xs">
                    Go to task
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => snooze(alert.id)}
                >
                  Snooze
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  onClick={() => dismiss(alert.id)}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
