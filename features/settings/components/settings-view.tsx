"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { PageShell } from "@/components/ui/page-shell";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useOps } from "@/features/ops/ops-provider";
import {
  appSettingsApi,
  type AppSettingsState,
} from "@/lib/api/profile-extras";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

type SettingsTab =
  | "general"
  | "notifications"
  | "security"
  | "integrations";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "General Configuration" },
  { id: "notifications", label: "Notification Rules" },
  { id: "security", label: "Security & Authorization" },
  { id: "integrations", label: "Connected Integrations" },
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

function SettingToggleRow({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="py-5 first:pt-0">
      <div className="min-w-0 max-w-[520px]">
        <p className="text-[18px] font-semibold leading-[29px] tracking-[-0.03em] text-[#1f1f21]">
          {title}
        </p>
        <p className="mt-0.5 text-[16px] font-normal leading-[21px] tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
          {detail}
        </p>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-[16px] font-normal leading-[21px] tracking-[-0.02em] text-[#1f1f21]">
        {label}
      </span>
      <span className="relative mt-[10px] block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-[45px] w-full appearance-none rounded-[5px] border border-[#cacaca] bg-white py-[14px] pl-[15px] pr-10 text-[14px] font-normal tracking-[-0.05em] text-[rgba(0,16,44,0.8)] outline-none focus-visible:border-[#377dff] focus-visible:ring-2 focus-visible:ring-[#377dff]/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/dashboard/chevron-down.svg"
          alt=""
          width={20}
          height={20}
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 opacity-70"
        />
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
      className="mt-6 inline-flex h-[39px] min-w-[125px] items-center justify-center rounded-[40px] bg-[#377dff] px-[45px] text-[16px] font-medium tracking-[-0.05em] text-[#fdfdfd] disabled:opacity-60"
    >
      Save
    </button>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
        {title}
      </h2>
      <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
        Your current sales summary and activity
      </p>
    </div>
  );
}

export function SettingsView() {
  const ops = useOps();
  const { toast } = useToast();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [navQuery, setNavQuery] = useState("");
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

  const visibleTabs = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter((item) => item.label.toLowerCase().includes(q));
  }, [navQuery]);

  function patchSettings(next: AppSettingsState) {
    setSettings(next);
    startTransition(() => {
      void appSettingsApi.save(next);
    });
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
      <PageShell wide className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] items-center">
        <div className="rounded-[10px] border border-[#e7e7e7] bg-white p-8 text-sm text-[rgba(0,0,0,0.5)]">
          Loading settings…
        </div>
      </PageShell>
    );
  }

  const activeTitle =
    TABS.find((item) => item.id === tab)?.label ?? "General Configuration";

  return (
    <PageShell wide className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] flex-col overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-5 overflow-hidden",
          pending && "opacity-90",
        )}
      >
        <section className="flex shrink-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
              Settings
            </h1>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              Your current sales summary and activity
            </p>
          </div>
          <AvailabilityToggle activeTaskCount={activeTaskCount} />
        </section>

        <div className="grid min-h-0 flex-1 gap-[25px] lg:grid-cols-[292px_minmax(0,1fr)] lg:items-start">
          {/* Left settings nav — tall like Figma */}
          <aside className="flex h-full min-h-0 w-full max-w-[292px] flex-col overflow-hidden rounded-[10px] bg-[#fdfdfd] px-5 py-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <label className="relative block shrink-0">
              <span className="sr-only">Search settings</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/figma/messages/icon-search.svg"
                alt=""
                width={20}
                height={20}
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 opacity-50"
              />
              <input
                type="search"
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-[10px] border border-[#e7e7e7] bg-white pl-10 pr-3 text-[14px] tracking-[-0.02em] text-[#1f1f21] outline-none placeholder:text-[rgba(0,0,0,0.4)] focus-visible:border-[#377dff]"
              />
            </label>

            <nav className="mt-10 min-h-0 flex-1 space-y-1" aria-label="Settings sections">
              {visibleTabs.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "flex h-[52px] w-full items-center rounded-[8px] px-4 text-left text-[14px] font-medium tracking-[-0.02em] transition-colors",
                      active
                        ? "border border-[#377dff] bg-[rgba(55,125,255,0.08)] text-[#377dff]"
                        : "border border-transparent text-[#1f1f21] hover:bg-[rgba(0,0,0,0.02)]",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right panel — content height only (Figma ~485–599), not stretched */}
          <section className="h-fit self-start rounded-[10px] bg-[#fdfdfd] px-5 py-5 pb-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <PanelHeader title={activeTitle} />

            {tab === "general" ? (
              <div>
                <div className="grid gap-[20px] sm:grid-cols-2">
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
                </div>

                <div className="mt-[25px] border-t border-[#e7e7e7] pt-5">
                  <SettingToggleRow
                    title="Dark Mode"
                    detail="Switch workspace interface to night-tuned theme."
                  />
                </div>

                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}

            {tab === "notifications" ? (
              <div>
                <div className="divide-y divide-[#e7e7e7]">
                  <SettingToggleRow
                    title="Email Alerts"
                    detail="Receive critical task assignment briefs on email."
                  />
                  <SettingToggleRow
                    title="Desktop Push Notifications"
                    detail="Show slide-in cards on new customer bookings."
                  />
                  <SettingToggleRow
                    title="Sound Alerts"
                    detail="Play audio chime on incoming chat updates."
                  />
                </div>
                <SaveButton
                  pending={pending}
                  onClick={() => toast("Notification preferences saved.", "success")}
                />
              </div>
            ) : null}

            {tab === "security" ? (
              <div>
                <SettingToggleRow
                  title="Two-Factor Authentication (2FA)"
                  detail="Enforce verified security token on logins."
                />

                <div className="mt-2 space-y-[15px] border-t border-[#e7e7e7] pt-6">
                  <Link
                    href={ROUTES.profileEdit}
                    className="inline-flex h-[41px] min-w-[220px] items-center justify-center rounded-[40px] border border-[#cacaca] bg-white px-11 text-[16px] font-medium tracking-[-0.05em] text-[#1f1f21]"
                  >
                    Change Password
                  </Link>
                  <div>
                    <button
                      type="button"
                      disabled={revoking}
                      onClick={() => {
                        startRevoke(async () => {
                          const result = await appSettingsApi.revokeSessions();
                          toast(result.message, "success");
                        });
                      }}
                      className="inline-flex h-[41px] min-w-[257px] items-center justify-center rounded-[40px] border border-[#cacaca] bg-white px-11 text-[16px] font-medium tracking-[-0.05em] text-[#1f1f21] disabled:opacity-60"
                    >
                      Revoke Active Sessions
                    </button>
                  </div>
                </div>

                <SaveButton pending={pending} onClick={handleSave} />
              </div>
            ) : null}

            {tab === "integrations" ? (
              <div>
                <div className="divide-y divide-[#e7e7e7]">
                  <SettingToggleRow
                    title="Slack Workspace Connector"
                    detail="Sync ticket notifications direct to Slack ops channel."
                  />
                  <SettingToggleRow
                    title="Stripe Escrow API"
                    detail="Verify transaction deposits and execute refunds instantly."
                  />
                  <SettingToggleRow
                    title="Zendesk Sync"
                    detail="Access verified guest profiles from core CRM pipeline."
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
