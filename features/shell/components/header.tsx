"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { UserMenu } from "@/features/shell/components/user-menu";
import { usePageChrome } from "@/features/shell/page-chrome";
import { useAgentMe } from "@/features/agents/hooks";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES, isTaskDetailPath, isTaskHubPath } from "@/lib/constants/routes";
import { getAgentDisplayName, type BackendUser } from "@/types/user";

type DashboardHeaderProps = {
  user: BackendUser;
};

function defaultChrome(pathname: string, name: string, email: string) {
  if (isTaskHubPath(pathname)) {
    return {
      title: "Task Hub",
      subtitle: "Accept a first offer, or open an assigned task and Start.",
    };
  }
  if (isTaskDetailPath(pathname)) {
    return {
      title: "Task workspace",
      subtitle: "Review details, chat with the customer, and update progress.",
    };
  }
  if (pathname.startsWith(ROUTES.messages)) {
    return {
      title: "Agent Chat",
      subtitle: "Respond directly to waiting customer inquiries",
    };
  }
  if (pathname.startsWith(ROUTES.payments)) {
    return {
      title: "Payments",
      subtitle: "Track transaction volume, pending payouts, and refunds",
    };
  }
  if (pathname.startsWith(ROUTES.history)) {
    return {
      title: "Activity Logs",
      subtitle: "Review chronological agent workspace events and audit trails",
    };
  }
  if (pathname.startsWith(ROUTES.notifications)) {
    return {
      title: "Notification Center",
      subtitle:
        "Monitor active agent requests, channel notifications, and core platform messages",
    };
  }
  if (pathname.startsWith(ROUTES.profileEdit)) {
    return {
      title: "Edit Profile",
      subtitle: "Update your display name and account password.",
    };
  }
  if (pathname.startsWith(ROUTES.profile)) {
    return {
      title: "User Profile",
      subtitle:
        "Manage your contact coordinates, observe dispatch ratings, and view workspace stats.",
    };
  }
  if (pathname.startsWith(ROUTES.settings)) {
    return {
      title: "App Settings",
      subtitle:
        "Configure system parameters, alert settings, verification thresholds, and connected channels.",
    };
  }
  if (pathname.startsWith(ROUTES.adminChat)) {
    return {
      title: "Admin Chat",
      subtitle: "Message Carl ops directly. Separate from client task chats.",
    };
  }
  if (pathname.startsWith(ROUTES.inbox)) {
    return {
      title: "Inbox",
      subtitle:
        "Blocked on the customer or a payment approval — these need a nudge or follow-up.",
    };
  }
  if (pathname === ROUTES.dashboard) {
    return {
      title: `Welcome ${name}`,
      subtitle: `Signed in as ${email}`,
    };
  }
  return {
    title: "Agent Workspace",
    subtitle: `Signed in as ${email}`,
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { data } = useAgentMe(user);
  const current = data ?? user;
  const name = getAgentDisplayName(current);
  const pathname = usePathname();
  const router = useRouter();
  const pageChrome = usePageChrome();
  const ops = useOps();
  const [workspaceQuery, setWorkspaceQuery] = useState("");

  const fallback = defaultChrome(pathname, name, current.email);
  const title = pageChrome?.chrome?.title ?? fallback.title;
  const subtitle = pageChrome?.chrome?.subtitle ?? fallback.subtitle;

  const presence = ops?.presence ?? "AVAILABLE";
  const online = presence === "AVAILABLE" || presence === "BUSY";
  const statusLabel =
    presence === "BUSY"
      ? "Busy"
      : presence === "OFFLINE"
        ? "Offline"
        : "Available";

  function onWorkspaceSearch(event: FormEvent) {
    event.preventDefault();
    const q = workspaceQuery.trim();
    if (!q) return;
    router.push(`${ROUTES.tasks}?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex min-h-[length:var(--header-height)] items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 md:px-6 lg:px-8">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
        <form
          onSubmit={onWorkspaceSearch}
          className="relative hidden w-[min(100%,17.5rem)] lg:block xl:w-72"
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-dim"
            aria-hidden
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            value={workspaceQuery}
            onChange={(event) => setWorkspaceQuery(event.target.value)}
            placeholder="Search workspace..."
            aria-label="Search workspace"
            className="h-11 w-full rounded-[var(--radius-pill)] border border-border bg-surface pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-dim focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
          />
        </form>

        <NotificationBell />

        <UserMenu
          user={current}
          statusLabel={statusLabel}
          online={online}
        />
      </div>
    </header>
  );
}
