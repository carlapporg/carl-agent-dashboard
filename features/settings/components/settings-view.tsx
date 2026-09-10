"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ChevronIcon } from "@/components/ui/chevron-icon";
import { PageShell } from "@/components/ui/page-shell";
import { Switch } from "@/components/ui/switch";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useNotifications } from "@/features/notifications/notification-provider";
import { useOps } from "@/features/ops/ops-provider";
import {
  appSettingsApi,
  type AppSettingsState,
} from "@/lib/api/profile-extras";
import { unlockNotificationAudio, playNotificationChime } from "@/lib/notifications/sound";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

type SettingsTab =
  | "general"
  | "notifications"
  | "security"
  | "integrations";

const TABS: Array<{ id: SettingsTab; label: string; shortLabel: string }> = [
  { id: "general", label: "General Configuration", shortLabel: "General" },
  {
    id: "notifications",
    label: "Notification Rules",
    shortLabel: "Notifications",
  },
  {
    id: "security",
    label: "Security & Authorization",
    shortLabel: "Security",
  },
  {
    id: "integrations",
    label: "Connected Integrations",
    shortLabel: "Integrations",
  },
];

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English ( United States)" },
  { value: "en-GB", label: "English ( United Kingdom)" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Karachi", label: "UTC + 500 - Asia Karachi" },
  { value: "UTC", label: "UTC + 000 - Coordinated Universal Time" },
  { value: "America/New_York", label: "UTC - 500 - America New York" },
];

function ComingSoonBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium tracking-[-0.02em] text-muted">
      Coming soon
    </span>
  );
}

function SettingToggleRow({
  title,
  detail,
  checked,
  onCheckedChange,
  label,
  comingSoon,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  comingSoon?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-4 first:pt-0 sm:gap-6 sm:py-5",
        comingSoon && "opacity-70",
      )}
    >
      <div className="min-w-0 max-w-[520px]">
        <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold leading-[24px] tracking-[-0.03em] text-foreground sm:text-[18px] sm:leading-[29px]">
          <span>{title}</span>
          {comingSoon ? <ComingSoonBadge /> : null}
        </p>
        <p className="mt-0.5 text-[14px] font-normal leading-[20px] tracking-[-0.02em] text-muted sm:text-[16px] sm:leading-[21px]">
          {detail}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={label}
        disabled={comingSoon}
        className="mt-1 shrink-0"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  className,
  comingSoon,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
  comingSoon?: boolean;
}) {
  return (
    <label className={cn("block min-w-0", comingSoon && "opacity-70", className)}>
      <span className="flex flex-wrap items-center gap-2 text-[15px] font-normal leading-[21px] tracking-[-0.02em] text-foreground sm:text-[16px]">
        <span>{label}</span>
        {comingSoon ? <ComingSoonBadge /> : null}
      </span>
      <span className="relative mt-[10px] block">
        <select
          value={value}
          disabled={comingSoon}
          onChange={(event) => onChange(event.target.value)}
          className="box-border h-[45px] w-full appearance-none rounded-[5px] border border-border bg-surface py-0 pl-[15px] pr-10 text-[14px] font-normal leading-[45px] tracking-[-0.05em] text-foreground-soft outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-foreground opacity-70" />
      </span>
    </label>
  );
}

function SaveButton({
  pending,
  onClick,
}: {
  pending?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="mt-6 inline-flex h-[39px] w-full min-w-0 items-center justify-center rounded-[40px] bg-accent px-8 text-[16px] font-medium tracking-[-0.05em] text-accent-foreground disabled:opacity-60 sm:w-auto sm:min-w-[125px] sm:px-[45px]"
    >
      Save
    </button>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-5 sm:mb-8">
      <h2 className="text-[22px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[34px]">
        {title}
      </h2>
      <p className="mt-2 hidden text-[16px] font-normal tracking-[-0.02em] text-muted sm:mt-3 sm:block">
        Your current sales summary and activity
      </p>
    </div>
  );
}

export function SettingsView() {
  const ops = useOps();
  const { toast } = useToast();
  const { setDarkMode } = useTheme();
  const { prefs, setPrefs } = useNotifications();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<AppSettingsState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void appSettingsApi.get().then((row) => {
      if (!cancelled) setSettings(row);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTaskCount = useMemo(() => {
    const live = ops?.liveTasks ?? [];
    return live.filter(
      (t) =>
        !t.parentId &&
        (t.backendStatus === "OFFERED" ||
          t.backendStatus === "ASSIGNED" ||
          t.backendStatus === "IN_PROGRESS" ||
          t.backendStatus === "WAITING_FOR_USER" ||
          t.backendStatus === "WAITING_FOR_AGENT"),
    ).length;
  }, [ops?.liveTasks]);

  function patchSettings(next: AppSettingsState) {
    setSettings(next);
    setDarkMode(next.darkMode);
    void appSettingsApi.save(next);
  }

  function handleSave() {
    if (!settings) return;
    startTransition(async () => {
      await appSettingsApi.save(settings);
      toast("Settings saved.", "success");
    });
  }

  if (!settings) {
    return (
      <PageShell
        wide
        className="flex min-h-[40vh] items-center lg:h-[calc(100dvh-8.5rem)] lg:max-h-[calc(100dvh-8.5rem)]"
      >
        <div className="rounded-[10px] border border-border bg-surface p-6 text-sm text-muted sm:p-8">
          Loading settings…
        </div>
      </PageShell>
    );
  }

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0]!;
  const activeTitle = activeTab.label;

  return (
    <PageShell
      wide
      className={cn(
        "flex flex-col pb-8",
        /* Desktop only: Figma viewport fit. Mobile scrolls with #dashboard-scroll. */
        "lg:h-[calc(100dvh-8.5rem)] lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-hidden lg:pb-0",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 sm:gap-5",
          "lg:min-h-0 lg:flex-1 lg:overflow-hidden",
        )}
      >
        <section className="flex shrink-0 flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[34px]">
              Settings
            </h1>
            <p className="mt-2 hidden text-[16px] font-normal tracking-[-0.02em] text-muted sm:mt-3 sm:block">
              Your current sales summary and activity
            </p>
          </div>
          <AvailabilityToggle activeTaskCount={activeTaskCount} />
        </section>

        {/* Mobile: section picker (no cramped horizontal tabs) */}
        <label className="block lg:hidden">
          <span className="sr-only">Settings section</span>
          <span className="relative block">
            <select
              value={tab}
              onChange={(event) => setTab(event.target.value as SettingsTab)}
              className="box-border h-[45px] w-full appearance-none rounded-[10px] border border-border bg-surface py-0 pl-4 pr-10 text-[14px] font-medium tracking-[-0.02em] text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
            >
              {TABS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.shortLabel}
                </option>
              ))}
            </select>
            <ChevronIcon className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-foreground opacity-70" />
          </span>
        </label>

        <div className="grid gap-4 sm:gap-[25px] lg:min-h-0 lg:flex-1 lg:grid-cols-[292px_minmax(0,1fr)] lg:items-start lg:overflow-hidden">
          {/* Desktop left nav */}
          <aside className="hidden h-auto w-full flex-col rounded-[10px] border border-border bg-surface px-5 py-5 lg:flex lg:h-full lg:max-w-[292px] lg:min-h-0 lg:overflow-hidden">
            <nav
              className="min-h-0 flex-1 space-y-1"
              aria-label="Settings sections"
            >
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "flex h-[52px] w-full items-center rounded-[8px] px-4 text-left text-[14px] font-medium tracking-[-0.02em] transition-colors",
                      active
                        ? "border border-accent bg-accent-soft text-accent"
                        : "border border-transparent text-foreground hover:bg-surface-hover",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="h-fit min-w-0 self-start rounded-[10px] border border-border bg-surface px-4 py-4 pb-5 sm:px-5 sm:py-5 sm:pb-6">
            <PanelHeader title={activeTitle} />

            {tab === "general" ? (
              <div>
                <div className="grid gap-[20px] sm:grid-cols-2">
                  <SelectField
                    label="Default Workspace Language"
                    value={settings.language}
                    options={LANGUAGE_OPTIONS}
                    comingSoon
                    onChange={(language) =>
                      patchSettings({ ...settings, language })
                    }
                  />
                  <SelectField
                    label="Timezone Sync"
                    value={settings.timezone}
                    options={TIMEZONE_OPTIONS}
                    comingSoon
                    onChange={(timezone) =>
                      patchSettings({ ...settings, timezone })
                    }
                  />
                </div>

                <div className="mt-[25px] border-t border-border pt-5">
                  <SettingToggleRow
                    title="Dark Mode"
                    detail="Switch workspace interface to night-tuned theme."
                    checked={settings.darkMode}
                    label="Dark Mode"
                    onCheckedChange={(darkMode) =>
                      patchSettings({ ...settings, darkMode })
                    }
                  />
                </div>

                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}

            {tab === "notifications" ? (
              <div>
                <div className="divide-y divide-border">
                  <SettingToggleRow
                    title="Sound Alerts"
                    detail="Play audio chime on incoming offers and chat updates."
                    checked={prefs.sound}
                    label="Sound Alerts"
                    onCheckedChange={(sound) => {
                      setPrefs({ ...prefs, sound });
                      if (sound) {
                        unlockNotificationAudio();
                        window.setTimeout(() => playNotificationChime(), 50);
                      }
                      if (settings) {
                        patchSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            soundAlerts: sound,
                          },
                        });
                      }
                    }}
                  />
                </div>
                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}

            {tab === "security" ? (
              <div>
                <SettingToggleRow
                  title="Two-Factor Authentication (2FA)"
                  detail="Enforce verified security token on logins."
                  checked={settings.twoFactorEnabled}
                  label="Two-Factor Authentication"
                  onCheckedChange={(twoFactorEnabled) =>
                    patchSettings({ ...settings, twoFactorEnabled })
                  }
                />

                <div className="mt-2 flex flex-col gap-[15px] border-t border-border pt-6">
                  <Link
                    href={ROUTES.profileEdit}
                    className="inline-flex h-[41px] w-full items-center justify-center rounded-[40px] border border-border bg-surface px-6 text-[15px] font-medium tracking-[-0.05em] text-foreground sm:w-auto sm:min-w-[220px] sm:px-11 sm:text-[16px]"
                  >
                    Change Password
                  </Link>
                  <div>
                    <button
                      type="button"
                      disabled
                      aria-disabled
                      className="inline-flex h-[41px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-[40px] border border-border bg-surface px-6 text-[15px] font-medium tracking-[-0.05em] text-foreground opacity-70 sm:w-auto sm:min-w-[257px] sm:px-11 sm:text-[16px]"
                    >
                      Revoke Active Sessions
                      <ComingSoonBadge />
                    </button>
                  </div>
                </div>

                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}

            {tab === "integrations" ? (
              <div>
                <div className="divide-y divide-border">
                  <SettingToggleRow
                    title="Slack Workspace Connector"
                    detail="Sync ticket notifications direct to Slack ops channel."
                    checked={settings.integrations.slack}
                    label="Slack Workspace Connector"
                    comingSoon
                    onCheckedChange={(slack) =>
                      patchSettings({
                        ...settings,
                        integrations: { ...settings.integrations, slack },
                      })
                    }
                  />
                  <SettingToggleRow
                    title="Stripe Escrow API"
                    detail="Verify transaction deposits and execute refunds instantly."
                    checked={settings.integrations.stripe}
                    label="Stripe Escrow API"
                    comingSoon
                    onCheckedChange={(stripe) =>
                      patchSettings({
                        ...settings,
                        integrations: { ...settings.integrations, stripe },
                      })
                    }
                  />
                  <SettingToggleRow
                    title="Zendesk Sync"
                    detail="Access verified guest profiles from core CRM pipeline."
                    checked={settings.integrations.zendesk}
                    label="Zendesk Sync"
                    comingSoon
                    onCheckedChange={(zendesk) =>
                      patchSettings({
                        ...settings,
                        integrations: { ...settings.integrations, zendesk },
                      })
                    }
                  />
                </div>
                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
