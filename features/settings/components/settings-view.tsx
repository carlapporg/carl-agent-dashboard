"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useNotifications } from "@/features/notifications/notification-provider";
import { useComingSoon } from "@/hooks/use-coming-soon";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { Switch } from "@/components/ui/switch";
import {
  appSettingsApi,
  type AppSettingsState,
} from "@/lib/api/profile-extras";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Karachi", label: "UTC+05:00 (Asia/Karachi - Lahore Time)" },
  { value: "UTC", label: "UTC+00:00 (Coordinated Universal Time)" },
  { value: "America/New_York", label: "UTC-05:00 (America/New_York)" },
];

function SettingRow({
  title,
  detail,
  control,
}: {
  title: string;
  detail: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 py-4 first:pt-0 last:pb-0">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsView() {
  const { prefs, setPrefs } = useNotifications();
  const { toast } = useToast();
  const comingSoon = useComingSoon();
  const [settings, setSettings] = useState<AppSettingsState | null>(null);
  const [pending, startTransition] = useTransition();
  const [revoking, startRevoke] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void appSettingsApi.get().then((row) => {
      if (!cancelled) setSettings(row);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function patchSettings(next: AppSettingsState) {
    setSettings(next);
    startTransition(() => {
      void appSettingsApi.save(next);
    });
  }

  if (!settings) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8 text-sm text-muted shadow-[var(--shadow-card)]">
          Loading settings…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={cn("mx-auto max-w-3xl space-y-4", pending && "opacity-90")}>
        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
          <h2 className="text-base font-semibold text-foreground">
            General Configuration
          </h2>
          <div className="mt-2 divide-y divide-border">
            <SelectField
              label="Default Workspace Language"
              value={settings.language}
              options={LANGUAGE_OPTIONS}
              onChange={(language) =>
                patchSettings({ ...settings, language })
              }
            />
            <SelectField
              label="Timezone Sync"
              value={settings.timezone}
              options={TIMEZONE_OPTIONS}
              onChange={(timezone) =>
                patchSettings({ ...settings, timezone })
              }
            />
            <SettingRow
              title="Dark Mode"
              detail="Switch workspace interface to night-tuned theme."
              control={
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(darkMode) => {
                    if (darkMode) {
                      comingSoon("Dark mode");
                      return;
                    }
                    patchSettings({ ...settings, darkMode });
                  }}
                  label="Dark Mode"
                />
              }
            />
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
          <h2 className="text-base font-semibold text-foreground">
            Notification Rules
          </h2>
          <div className="mt-2 divide-y divide-border">
            <SettingRow
              title="Email Alerts"
              detail="Receive critical task assignment briefs on email."
              control={
                <Switch
                  checked={prefs.taskAssigned}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, taskAssigned: checked })
                  }
                  label="Email Alerts"
                />
              }
            />
            <SettingRow
              title="Desktop Push Notifications"
              detail="Show slide-in cards on new customer bookings."
              control={
                <Switch
                  checked={prefs.desktop}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, desktop: checked })
                  }
                  label="Desktop Push Notifications"
                />
              }
            />
            <SettingRow
              title="Sound Alerts"
              detail="Play audio chime on incoming chat updates."
              control={
                <Switch
                  checked={prefs.sound}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, sound: checked })
                  }
                  label="Sound Alerts"
                />
              }
            />
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
          <h2 className="text-base font-semibold text-foreground">
            Security & Authorization
          </h2>
          <div className="mt-2 divide-y divide-border">
            <SettingRow
              title="Two-Factor Authentication (2FA)"
              detail="Enforce verified security token on logins."
              control={
                <Switch
                  checked={settings.twoFactorEnabled}
                  onCheckedChange={(twoFactorEnabled) => {
                    if (twoFactorEnabled) {
                      comingSoon("Two-factor authentication");
                      return;
                    }
                    patchSettings({ ...settings, twoFactorEnabled });
                  }}
                  label="Two-Factor Authentication"
                />
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={ROUTES.profileEdit}>
              <Button type="button" variant="secondary">
                Change Password
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              className="border-danger text-danger hover:bg-danger/10"
              loading={revoking}
              onClick={() => {
                startRevoke(async () => {
                  const result = await appSettingsApi.revokeSessions();
                  toast(result.message, "success");
                });
              }}
            >
              Revoke Active Sessions
            </Button>
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
          <h2 className="text-base font-semibold text-foreground">
            Connected Operations Integrations
          </h2>
          <div className="mt-2 divide-y divide-border">
            <SettingRow
              title="Slack Workspace Connector"
              detail="Sync ticket notifications direct to Slack ops channel."
              control={
                <Switch
                  checked={settings.integrations.slack}
                  onCheckedChange={(slack) =>
                    patchSettings({
                      ...settings,
                      integrations: { ...settings.integrations, slack },
                    })
                  }
                  label="Slack Workspace Connector"
                />
              }
            />
            <SettingRow
              title="Stripe Escrow API"
              detail="Verify transaction deposits and execute refunds instantly."
              control={
                <Switch
                  checked={settings.integrations.stripe}
                  onCheckedChange={(stripe) =>
                    patchSettings({
                      ...settings,
                      integrations: { ...settings.integrations, stripe },
                    })
                  }
                  label="Stripe Escrow API"
                />
              }
            />
            <SettingRow
              title="Zendesk Sync"
              detail="Access verified guest profiles from core CRM pipeline."
              control={
                <Switch
                  checked={settings.integrations.zendesk}
                  onCheckedChange={(zendesk) =>
                    patchSettings({
                      ...settings,
                      integrations: { ...settings.integrations, zendesk },
                    })
                  }
                  label="Zendesk Sync"
                />
              }
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
