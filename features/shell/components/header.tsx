"use client";

import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { UserMenu } from "@/features/shell/components/user-menu";
import { useAgentMe } from "@/features/agents/hooks";
import type { BackendUser } from "@/types/user";

type DashboardHeaderProps = {
  user: BackendUser;
};

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { data } = useAgentMe(user);
  const current = data ?? user;

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-5 lg:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base">
          Agent Dashboard
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          Signed in as {current.email}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <AvailabilityToggle compact />
        <NotificationBell />
        <UserMenu user={current} />
      </div>
    </header>
  );
}
