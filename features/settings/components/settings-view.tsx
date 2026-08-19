"use client";

import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Card, CardBody } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const NOTIFICATION_SETTINGS = [
  {
    title: "Desktop notifications",
    detail: "Alert when a task is assigned or payment is approved.",
    defaultChecked: true,
  },
  {
    title: "Sound",
    detail: "Play a soft chime for urgent tasks.",
    defaultChecked: false,
  },
] as const;

const DISPLAY_SETTINGS = [
  {
    title: "Compact task list",
    detail: "Show denser rows on the Tasks screen.",
    defaultChecked: false,
  },
] as const;

function SettingRow({
  title,
  detail,
  defaultChecked,
}: {
  title: string;
  detail: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
        <p className="mt-2 text-sm text-muted-dim">Coming soon</p>
      </div>
      <Switch
        checked={defaultChecked}
        disabled
        title="Coming soon"
        label={`${title} (coming soon)`}
      />
    </div>
  );
}

export function SettingsView() {
  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Notification and display preferences. These controls are preview-only for now."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardBody>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Notifications
            </h2>
            <div className="mt-3 divide-y divide-border">
              {NOTIFICATION_SETTINGS.map((item) => (
                <SettingRow key={item.title} {...item} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Display
            </h2>
            <div className="mt-3 divide-y divide-border">
              {DISPLAY_SETTINGS.map((item) => (
                <SettingRow key={item.title} {...item} />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
