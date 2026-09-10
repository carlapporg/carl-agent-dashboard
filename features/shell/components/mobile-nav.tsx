"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const clearCache = useClearAppCache();

  function navActive(href: string) {
    if (href === ROUTES.dashboard) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="border-b border-border bg-surface lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href={ROUTES.dashboard} className="block" onClick={() => setOpen(false)}>
          <p className="text-base font-bold tracking-tight text-foreground">
            Carl
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[var(--letter-nav)] text-muted-dim">
            Agent workspace
          </p>
        </Link>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border px-3.5 text-sm font-semibold text-foreground"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <nav
          id="mobile-nav"
          className="space-y-1 border-t border-border px-3 py-3"
          aria-label="Mobile"
        >
          {PRIMARY_NAV.map((item) => {
            const active = navActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <NavIcon id={item.icon} />
                <span className="flex-1">
                  {navDisplayLabel(item.href, item.label)}
                </span>
              </Link>
            );
          })}

          {SETTINGS_NAV_ITEM ? (
            <Link
              href={SETTINGS_NAV_ITEM.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium",
                navActive(SETTINGS_NAV_ITEM.href)
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <NavIcon id={SETTINGS_NAV_ITEM.icon} />
              <span className="flex-1">Settings</span>
            </Link>
          ) : null}

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] bg-danger-soft px-3 py-2.5 text-left text-sm font-medium text-danger"
            onClick={() => {
              setOpen(false);
              clearCache();
              clearManualPresence();
              void logoutAction();
            }}
          >
            Log out
          </button>
        </nav>
      ) : null}
    </div>
  );
}
