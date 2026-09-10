"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/features/auth/actions/auth";
import { useClearAppCache } from "@/features/agents/hooks";
import {
  NavIcon,
  PRIMARY_NAV,
  SETTINGS_NAV_ITEM,
  navDisplayLabel,
} from "@/features/shell/nav-items";
import { clearManualPresence } from "@/lib/agent/presence";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export function DashboardSidebar() {
  const pathname = usePathname();
  const clearCache = useClearAppCache();

  function navActive(href: string) {
    if (href === ROUTES.dashboard) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={cn(
        /* Figma Side Menu 200:24912 — pinned to viewport, footer stays on screen */
        "sticky top-0 z-20 hidden h-dvh w-[285px] shrink-0",
        "border-r border-border bg-surface",
        "lg:flex lg:flex-col",
      )}
    >
      {/* Header — Figma 285×68 */}
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-border px-5">
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
            <span className="block truncate text-[18px] font-medium leading-[1.3] tracking-[-0.05em] text-foreground-soft">
              Carl Dashboard
            </span>
            <span className="block truncate text-[10px] font-normal leading-[1.3] text-muted">
              Agent Workspace
            </span>
          </span>
        </Link>
      </div>

      <nav
        className="mt-6 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5"
        aria-label="Dashboard"
      >
        {PRIMARY_NAV.map((item) => {
          const active = navActive(item.href);
          const label = navDisplayLabel(item.href, item.label);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 shrink-0 items-center gap-3 rounded-[10px] px-3 text-[12px] font-medium tracking-[-0.02em] transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "[&_svg]:size-5",
                  active ? "text-accent-foreground" : "text-muted-dim",
                )}
              >
                <NavIcon id={item.icon} />
              </span>
              <span className="flex-1 truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings + Log out — fixed to bottom of viewport (Figma y≈1005/1048) */}
      <div className="mt-auto shrink-0 space-y-2 border-t border-transparent px-5 pb-5 pt-3">
        {SETTINGS_NAV_ITEM ? (
          <Link
            href={SETTINGS_NAV_ITEM.href}
            className={cn(
              "flex h-9 items-center gap-3 rounded-[10px] px-3 text-[12px] font-medium tracking-[-0.02em]",
              navActive(SETTINGS_NAV_ITEM.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-muted",
            )}
          >
            <span
              className={cn(
                "[&_svg]:size-4",
                navActive(SETTINGS_NAV_ITEM.href)
                  ? "text-accent-foreground"
                  : "text-muted-dim",
              )}
            >
              <NavIcon id={SETTINGS_NAV_ITEM.icon} />
            </span>
            Settings
          </Link>
        ) : null}
        <button
          type="button"
          className="flex h-9 w-full items-center gap-3 rounded-[10px] bg-danger-soft px-3 text-left text-[12px] font-medium tracking-[-0.02em] text-danger"
          onClick={() => {
            clearCache();
            clearManualPresence();
            void logoutAction();
          }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="size-5 shrink-0"
          >
            <path
              d="M15.018 6.667V6.5c0-1.4 0-2.1-.273-2.635a2.5 2.5 0 0 0-1.092-1.092C13.118 2.5 12.418 2.5 11.018 2.5H6.516c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.092C2.516 4.4 2.516 5.1 2.516 6.5v7c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.092 1.092c.535.273 1.235.273 2.635.273h4.502c1.4 0 2.1 0 2.635-.273a2.5 2.5 0 0 0 1.092-1.092c.273-.535.273-1.235.273-2.635v-.167M10.661 6.442 7.103 10l3.558 3.558M7.103 10h10.398"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Log out
        </button>
      </div>
    </aside>
  );
}
