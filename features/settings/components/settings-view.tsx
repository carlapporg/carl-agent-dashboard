"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Card, CardBody } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type NotifPrefs = Awaited<
  ReturnType<typeof dashboardApi.getAgentPreferences>
>["notifications"];

const LABELS: Record<keyof NotifPrefs, { title: string; detail: string }> = {
  taskAssigned: {
    title: "Task assigned",
    detail: "When the system auto-assigns you a new task.",
  },
  paymentResult: {
    title: "Payment approved / declined",
    detail: "When a client responds to a payment request.",
  },
  slaWarning: {
    title: "SLA reply warning",
    detail: "When a client message is waiting too long.",
  },
  customerReply: {
    title: "Customer reply",
    detail: "When the client sends a new message on a task.",
  },
  desktop: {
    title: "Desktop notifications",
    detail: "Show system notifications in the browser.",
  },
  sound: {
    title: "Sound",
    detail: "Play a soft chime for urgent alerts.",
  },
};

export function SettingsView() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [compactList, setCompactList] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void dashboardApi.getAgentPreferences().then((p) => setPrefs(p.notifications));
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Granular notification preferences. Payout settings are not included."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardBody>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Notifications
            </h2>
            {!prefs ? (
              <p className="mt-3 text-sm text-muted">Loading…</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {(Object.keys(LABELS) as Array<keyof NotifPrefs>).map((key) => (
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
                        setSaved(false);
                      }}
                      label={LABELS[key].title}
                    />
                  </div>
                ))}
              </div>
            )}
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
                onCheckedChange={(v) => {
                  setCompactList(v);
                  setSaved(false);
                }}
                label="Compact task list"
              />
            </div>
          </CardBody>
        </Card>

        <button
          type="button"
          className="text-sm font-semibold text-accent hover:text-accent-hover"
          onClick={() => setSaved(true)}
        >
          {saved ? "Preferences saved (local mock)" : "Save preferences"}
        </button>
      </div>
    </PageShell>
  );
}
