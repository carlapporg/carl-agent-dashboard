"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/features/notifications/notification-provider";
import { DASHBOARD_NAV } from "@/features/shell/nav-items";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col xl:w-72">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href={DASHBOARD_NAV[0].href} className="group block min-w-0">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Carl
          </p>
          <p className="mt-0.5 text-sm font-medium text-muted">
            Agent workspace
          </p>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-3 py-4">
        <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-dim">
          Navigation
        </p>
        <nav className="flex flex-col gap-2" aria-label="Dashboard">
          {DASHBOARD_NAV.map((item) => {
            const active =
              item.href === DASHBOARD_NAV[0].href
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const showUnread =
              item.href === ROUTES.notifications && unreadCount > 0;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent shadow-sm"
                    : "text-foreground-soft hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-accent"
                    aria-hidden
                  />
                ) : null}
                <span>{item.label}</span>
                {showUnread ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="text-sm leading-relaxed text-muted">
          Handle requests calmly. Ask → Confirm → Done.
        </p>
      </div>
    </aside>
  );
}
