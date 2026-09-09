"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { logoutAction } from "@/features/auth/actions/auth";
import { useClearAppCache } from "@/features/agents/hooks";
import { useNotifications } from "@/features/notifications/notification-provider";
import { DASHBOARD_NAV, NavIcon } from "@/features/shell/nav-items";
import { clearManualPresence } from "@/lib/agent/presence";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

/** Figma Side Menu order (extra routes stay reachable elsewhere). */
const FIGMA_PRIMARY_HREFS = new Set<string>([
  ROUTES.dashboard,
  ROUTES.tasks,
  ROUTES.messages,
  ROUTES.payments,
  ROUTES.history,
  ROUTES.profile,
]);
const PRIMARY_NAV = DASHBOARD_NAV.filter((item) =>
  FIGMA_PRIMARY_HREFS.has(item.href),
);
const SETTINGS_ITEM = DASHBOARD_NAV.find((item) => item.href === ROUTES.settings);

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const clearCache = useClearAppCache();
  const [query, setQuery] = useState("");

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${ROUTES.tasks}?q=${encodeURIComponent(q)}`);
  }

  function navActive(href: string) {
    if (href === ROUTES.dashboard) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={cn(
        /* Figma Side Menu 200:24912 — pinned to viewport, footer stays on screen */
        "sticky top-0 z-20 hidden h-dvh w-[285px] shrink-0",
        "border-r border-[var(--dash-border,#e7e7e7)] bg-white",
        "lg:flex lg:flex-col",
      )}
    >
      {/* Header — Figma 285×68 */}
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-[var(--dash-border,#e7e7e7)] px-5">
        <Link href={ROUTES.dashboard} className="flex min-w-0 items-center gap-2.5">
          <span
            className="relative size-10 shrink-0 overflow-hidden rounded-[8px]"
            style={{
              backgroundImage:
                "linear-gradient(-66.86deg, rgb(236, 225, 254) 24.25%, rgba(201, 241, 255, 0.8) 100%)",
            }}
            aria-hidden
          >
            {/* Figma Logo plate — soft glow export */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/dashboard/logo.png"
              alt=""
              width={40}
              height={40}
              className="absolute inset-0 size-full object-cover"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[18px] font-medium leading-[1.3] tracking-[-0.05em] text-[rgba(0,0,0,0.7)]">
              Carl Dashboard
            </span>
            <span className="block truncate text-[10px] font-normal leading-[1.3] text-[rgba(0,0,0,0.5)]">
              Agent Workspace
            </span>
          </span>
        </Link>
      </div>

      <div className="shrink-0 px-5 pt-6">
        <form onSubmit={onSearch}>
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[#98a2b3]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="m16.5 16.5 3 3"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search"
              className="h-10 w-full rounded-[10px] bg-[#f6f6f6] pl-9 pr-3 text-[14px] text-[#1f1f21] outline-none placeholder:text-[#98a2b3]"
            />
          </label>
        </form>
      </div>

      <nav
        className="mt-6 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5"
        aria-label="Dashboard"
      >
        {PRIMARY_NAV.map((item) => {
          const active = navActive(item.href);
          const showUnread =
            item.href === ROUTES.notifications && unreadCount > 0;
          const label =
            item.href === ROUTES.dashboard
              ? "Dashboard"
              : item.href === ROUTES.tasks
                ? "Task"
                : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 shrink-0 items-center gap-3 rounded-[10px] px-3 text-[12px] font-medium tracking-[-0.02em] transition-colors",
                active
                  ? "bg-[#377dff] text-white"
                  : "text-[rgba(0,0,0,0.55)] hover:bg-[#f6f6f6] hover:text-[#1f1f21]",
              )}
            >
              <span
                className={cn(
                  "[&_svg]:size-5",
                  active ? "text-white" : "text-[#98a2b3]",
                )}
              >
                <NavIcon id={item.icon} />
              </span>
              <span className="flex-1 truncate">{label}</span>
              {showUnread ? (
                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[9px] font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Log out — fixed to bottom of viewport (Figma y≈1005/1048) */}
      <div className="mt-auto shrink-0 space-y-2 border-t border-transparent px-5 pb-5 pt-3">
        {SETTINGS_ITEM ? (
          <Link
            href={SETTINGS_ITEM.href}
            className={cn(
              "flex h-9 items-center gap-3 rounded-[10px] px-3 text-[12px] font-medium tracking-[-0.02em]",
              navActive(SETTINGS_ITEM.href)
                ? "bg-[#377dff] text-white"
                : "text-[rgba(0,0,0,0.55)] hover:bg-[#f6f6f6]",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/dashboard/settings-gear.svg"
              alt=""
              width={16}
              height={16}
              className={cn(
                "size-4",
                navActive(SETTINGS_ITEM.href) && "brightness-0 invert",
              )}
            />
            Settings
          </Link>
        ) : null}
        <button
          type="button"
          className="flex h-9 w-full items-center gap-3 rounded-[10px] bg-[#feeceb] px-3 text-left text-[12px] font-medium tracking-[-0.02em] text-[#fc4438]"
          onClick={() => {
            clearCache();
            clearManualPresence();
            void logoutAction();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/dashboard/logout.svg"
            alt=""
            width={20}
            height={20}
            className="size-5"
          />
          Log out
        </button>
      </div>
    </aside>
  );
}
