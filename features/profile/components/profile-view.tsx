"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentMe } from "@/features/agents/hooks";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import {
  profileExtrasApi,
  type ProfileActivityItem,
  type ProfileContactDetails,
  type ProfileStats,
} from "@/lib/api/profile-extras";
import { ROUTES } from "@/lib/constants/routes";
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
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (kind === "message") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
      </svg>
    </span>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function ProfileView({ initialUser }: ProfileViewProps) {
  const router = useRouter();
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

  return (
    <PageShell wide>
      <div className="mb-4 flex justify-end">
        <Link href={ROUTES.profileEdit}>
          <Button type="button" variant="secondary">
            Edit profile
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {name}
            </h2>
            <span className="mt-2 inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
              Support agent
            </span>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Contact information
            </p>
            <div className="mt-2 divide-y divide-border">
              <ContactRow label="Email Address" value={current.email} />
              <ContactRow
                label="Phone Number"
                value={details?.phone ?? "—"}
              />
              <ContactRow
                label="Department"
                value={details?.department ?? "—"}
              />
              <ContactRow
                label="Primary Workspace"
                value={details?.primaryWorkspace ?? "—"}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tasks Completed
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {stats?.tasksCompleted ?? "—"}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Avg Response Time
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {stats ? `${stats.avgResponseMins}m` : "—"}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Customer Rating
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {stats?.customerRating != null
                  ? `${stats.customerRating.toFixed(1)}/5.0`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
            <h3 className="text-base font-semibold text-foreground">
              Recent Activity Feed
            </h3>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No recent activity.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                    <ActivityIcon kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <time className="shrink-0 text-xs text-muted-dim">
                          {formatRel(item.at)}
                        </time>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
