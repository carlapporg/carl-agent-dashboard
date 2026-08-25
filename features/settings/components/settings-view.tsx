"use client";

import { useState } from "react";
import { useNotifications } from "@/features/notifications/notification-provider";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Card, CardBody } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { NotificationPrefs } from "@/types/dashboard";

const LABELS: Record<keyof NotificationPrefs, { title: string; detail: string }> =
  {
    taskAssigned: {
      title: "Task assigned",
      detail: "When a new task is offered or assigned to you.",
    },
    paymentResult: {
      title: "Payment approved / declined",
      detail: "When a client responds to a payment request.",
    },
    slaWarning: {
      title: "Needs your attention",
      detail: "When a task is waiting for you to reply or continue.",
    },
    customerReply: {
      title: "Customer reply",
      detail: "When the client sends a new message and you are not in that chat.",
    },
    desktop: {
      title: "Desktop notifications",
      detail: "Show a system notification when this tab is in the background.",
    },
    sound: {
      title: "Notification sound",
      detail: "Play a short chime when a new notification arrives.",
    },
  };

export function SettingsView() {
  const { prefs, setPrefs } = useNotifications();
  const [compactList, setCompactList] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Choose which notifications you get, and whether they play a sound."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardBody>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Notifications
            </h2>
            <div className="mt-3 divide-y divide-border">
              {(Object.keys(LABELS) as Array<keyof NotificationPrefs>).map(
                (key) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {LABELS[key].title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {LABELS[key].detail}
                      </p>
                    </div>
                    <Switch
                      checked={prefs[key]}
                      onCheckedChange={(checked) => {
                        setPrefs({ ...prefs, [key]: checked });
                        setSaved(true);
                      }}
                      label={LABELS[key].title}
                    />
                  </div>
                ),
              )}
            </div>
            {saved ? (
              <p className="mt-3 text-sm text-success-foreground">
                Saved on this device.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Display
            </h2>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Compact task list
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Show denser rows on the Tasks screen.
                </p>
              </div>
              <Switch
                checked={compactList}
                onCheckedChange={setCompactList}
                label="Compact task list"
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
