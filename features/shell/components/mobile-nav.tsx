"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DASHBOARD_NAV, NavIcon } from "@/features/shell/nav-items";
import { useNotifications } from "@/features/notifications/notification-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <div className="border-b border-border bg-surface lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href={DASHBOARD_NAV[0]!.href} className="block">
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
          {DASHBOARD_NAV.map((item) => {
            const active =
              item.href === DASHBOARD_NAV[0]!.href
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const showUnread =
              item.href === ROUTES.notifications && unreadCount > 0;
            return (
              <Link
                key={item.label}
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
                <span className="flex-1">{item.label}</span>
                {showUnread ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
