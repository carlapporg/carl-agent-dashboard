"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentMe } from "@/features/agents/hooks";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useOps } from "@/features/ops/ops-provider";
import {
  profileExtrasApi,
  type ProfileActivityItem,
  type ProfileContactDetails,
  type ProfileStats,
} from "@/lib/api/profile-extras";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";

type ProfileViewProps = {
  initialUser: BackendUser;
};

function formatRel(iso: string): string {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityIcon({ kind }: { kind: ProfileActivityItem["kind"] }) {
  if (kind === "resolved") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(61,188,61,0.2)] text-[#3dbc3d]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (kind === "message") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(84,149,253,0.2)] text-[#377dff]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(245,158,11,0.18)] text-[#b45309]">
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
      </svg>
    </span>
  );
}

/** Figma read-only field — 45px, border #cacaca, radius 5 */
function ProfileField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[16px] font-normal leading-[21px] tracking-[-0.02em] text-[#1f1f21]">
        {label}
      </p>
      <div className="mt-[10px] flex h-[45px] items-center rounded-[5px] border border-[#cacaca] bg-white px-[15px]">
        <p className="truncate text-[14px] font-normal tracking-[-0.05em] text-[rgba(0,16,44,0.8)]">
          {value}
        </p>
      </div>
    </div>
  );
}

function personalIdLabel(user: BackendUser): string {
  const raw = user.id.replace(/[^a-zA-Z0-9]/g, "");
  const short = raw.slice(-4).toUpperCase() || "—";
  return `ID - ${short}`;
}

export function ProfileView({ initialUser }: ProfileViewProps) {
  const router = useRouter();
  const ops = useOps();
  const { data: user, isPending, isError, error } = useAgentMe(initialUser);
  const current = user ?? initialUser;
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [details, setDetails] = useState<ProfileContactDetails | null>(null);
  const [activity, setActivity] = useState<ProfileActivityItem[]>([]);

  useEffect(() => {
    if (!isError || user) return;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("session") ||
      message.includes("sign in") ||
      message.includes("unauthorized")
    ) {
      router.replace(`${ROUTES.sessionClear}?reason=expired`);
    }
  }, [isError, error, user, router]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      profileExtrasApi.getStats(),
      profileExtrasApi.getContactDetails(),
      profileExtrasApi.getActivity(),
    ]).then(([nextStats, nextDetails, nextActivity]) => {
      if (cancelled) return;
      setStats(nextStats);
      setDetails(nextDetails);
      setActivity(nextActivity);
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

  if (isPending && !current) {
    return (
      <PageShell wide>
        <PageSkeleton />
      </PageShell>
    );
  }

  if (!current) {
    return (
      <PageShell wide>
        <EmptyState
          title="Profile unavailable"
          description={
            error instanceof Error
              ? error.message
              : "We couldn’t load your agent profile."
          }
        />
      </PageShell>
    );
  }

  const name = getAgentDisplayName(current);
  const roleLabel =
    current.role === "ADMIN"
      ? "Admin"
      : current.role === "AGENT"
        ? "Agent"
        : "User";

  return (
    <PageShell wide>
      <div className="space-y-5">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
              Profile
            </h1>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              Your current sales summary and activity
            </p>
          </div>
          <Link
            href={ROUTES.profileEdit}
            className="inline-flex h-[35px] items-center rounded-[40px] bg-[#eefbff] px-6 text-[12px] font-medium tracking-[-0.05em] text-[#377dff]"
          >
            Edit profile
          </Link>
        </section>

        <div className="grid gap-[25px] lg:grid-cols-[292px_minmax(0,1fr)] lg:items-start">
          {/* Left summary card — Figma 292×293 */}
          <aside className="flex flex-col items-center rounded-[10px] bg-[#fdfdfd] px-5 pb-6 pt-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] lg:h-[293px]">
            <AgentAvatar
              user={current}
              size="xl"
              className="!size-[130px] !text-[40px] ring-0"
            />
            <p className="mt-[15px] text-center text-[16px] font-semibold leading-[22px] tracking-[-0.02em] text-[#1f1f21]">
              {name}
            </p>
            <p className="mt-1 text-center text-[12px] font-normal leading-4 tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              {roleLabel}
            </p>
            <div className="mt-5">
              <AvailabilityToggle activeTaskCount={activeTaskCount} />
            </div>
          </aside>

          {/* Personal Info — Figma right card */}
          <section className="rounded-[10px] bg-[#fdfdfd] px-5 py-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] md:px-5 md:py-5 lg:min-h-[862px]">
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
              Personal Info
            </h2>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              Your current sales summary and activity
            </p>

            <div className="mt-12 space-y-[35px]">
              <ProfileField label="Full Name" value={name} />

              <div className="grid gap-[25px] sm:grid-cols-2">
                <ProfileField label="Gender" value="—" />
                <ProfileField label="Date of birth" value="—" />
              </div>

              <div className="grid gap-[25px] sm:grid-cols-2">
                <ProfileField label="Email Address" value={current.email} />
                <ProfileField
                  label="Phone Number"
                  value={details?.phone ?? "—"}
                />
              </div>

              <ProfileField
                label="Personal ID"
                value={personalIdLabel(current)}
                className="sm:max-w-[calc(50%-12.5px)]"
              />
            </div>
          </section>
        </div>

        {/* Existing stats + activity — kept below Figma chrome */}
        <div className="grid gap-[25px] sm:grid-cols-3">
          <div className="rounded-[10px] border border-[#e7e7e7] bg-white p-4">
            <p className="text-[12px] font-medium tracking-[-0.03em] text-[rgba(0,0,0,0.5)]">
              Tasks Completed
            </p>
            <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-[-0.04em] text-[#1f1f21]">
              {stats?.tasksCompleted ?? "—"}
            </p>
          </div>
          <div className="rounded-[10px] border border-[#e7e7e7] bg-white p-4">
            <p className="text-[12px] font-medium tracking-[-0.03em] text-[rgba(0,0,0,0.5)]">
              Avg Response Time
            </p>
            <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-[-0.04em] text-[#1f1f21]">
              {stats ? `${stats.avgResponseMins}m` : "—"}
            </p>
          </div>
          <div className="rounded-[10px] border border-[#e7e7e7] bg-white p-4">
            <p className="text-[12px] font-medium tracking-[-0.03em] text-[rgba(0,0,0,0.5)]">
              Customer Rating
            </p>
            <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-[-0.04em] text-[#1f1f21]">
              {stats?.customerRating != null
                ? `${stats.customerRating.toFixed(1)}/5.0`
                : "—"}
            </p>
          </div>
        </div>

        <section className="rounded-[15px] border border-[#e7e7e7] bg-white px-5 py-5">
          <h3 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            Recent Activity Feed
          </h3>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-[rgba(0,0,0,0.5)]">No recent activity.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#e7e7e7]">
              {activity.map((item) => (
                <li key={item.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                  <ActivityIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1f1f21]">
                        {item.title}
                      </p>
                      <time className="shrink-0 text-xs text-[rgba(0,0,0,0.4)]">
                        {formatRel(item.at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm text-[rgba(0,0,0,0.5)]">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
