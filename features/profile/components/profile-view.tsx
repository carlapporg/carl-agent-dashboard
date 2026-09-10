"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAgentMe } from "@/features/agents/hooks";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";

type ProfileViewProps = {
  initialUser: BackendUser;
};

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
      <p className="text-[16px] font-normal leading-[21px] tracking-[-0.02em] text-foreground">
        {label}
      </p>
      <div className="mt-[10px] flex h-[45px] items-center rounded-[5px] border border-border bg-surface px-[15px]">
        <p className="truncate text-[14px] font-normal tracking-[-0.05em] text-foreground-soft">
          {value}
        </p>
      </div>
    </div>
  );
}

export function ProfileView({ initialUser }: ProfileViewProps) {
  const router = useRouter();
  const ops = useOps();
  const { data: user, isPending, isError, error } = useAgentMe(initialUser);
  const current = user ?? initialUser;

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
      <PageShell
        wide
        className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] items-center"
      >
        <PageSkeleton />
      </PageShell>
    );
  }

  if (!current) {
    return (
      <PageShell
        wide
        className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] items-center"
      >
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
    <PageShell
      wide
      className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
        <section className="flex shrink-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
              Profile
            </h1>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-muted">
              Your current sales summary and activity
            </p>
          </div>
          <Link
            href={ROUTES.profileEdit}
            className="inline-flex h-[35px] items-center rounded-[40px] bg-accent-soft px-6 text-[12px] font-medium tracking-[-0.05em] text-accent"
          >
            Edit profile
          </Link>
        </section>

        {/* Figma: right card ~862px tall with ~25px gap above frame bottom */}
        <div className="grid min-h-0 flex-1 gap-[25px] overflow-hidden pb-[25px] lg:grid-cols-[292px_minmax(0,1fr)] lg:items-stretch">
          <aside className="flex h-fit flex-col items-center self-start rounded-[10px] bg-surface px-5 pb-6 pt-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <AgentAvatar
              user={current}
              size="xl"
              className="!size-[130px] !text-[40px] ring-0"
            />
            <p className="mt-[15px] text-center text-[16px] font-semibold leading-[22px] tracking-[-0.02em] text-foreground">
              {name}
            </p>
            <p className="mt-1 text-center text-[12px] font-normal leading-4 tracking-[-0.02em] text-muted">
              {roleLabel}
            </p>
            <div className="mt-5">
              <AvailabilityToggle activeTaskCount={activeTaskCount} />
            </div>
          </aside>

          <section className="min-h-0 h-full overflow-hidden rounded-[10px] bg-surface px-5 py-5 pb-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <h2 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
              Personal Info
            </h2>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-muted">
              Your current sales summary and activity
            </p>

            <div className="mt-12 space-y-[35px]">
              <ProfileField label="Full Name" value={name} />
              <ProfileField
                label="Email Address"
                value={current.email}
                className="sm:max-w-[calc(50%-12.5px)]"
              />
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
