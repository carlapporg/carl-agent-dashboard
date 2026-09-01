"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/features/notifications/notification-provider";
import { DASHBOARD_NAV, NavIcon } from "@/features/shell/nav-items";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  return (
    <aside className="hidden w-[length:var(--sidebar-width)] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col xl:w-[length:var(--sidebar-width-xl)]">
      <div className="flex h-[length:var(--header-height)] items-center border-b border-border px-4">
        <Link href={DASHBOARD_NAV[0]!.href} className="group block min-w-0">
          <p className="text-lg font-bold leading-none tracking-tight text-foreground">
            Carl
          </p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-dim">
            Agent workspace
          </p>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-2.5 py-4">
        <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-dim">
          Navigation
        </p>
        <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
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
                className={cn(
                  "relative flex items-center gap-2.5 rounded-[var(--radius-md)] py-2 pl-2.5 pr-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span className="[&_svg]:size-[18px]">
                  <NavIcon id={item.icon} />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {showUnread ? (
                  <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border px-3.5 py-4">
        <p className="text-[11px] leading-relaxed text-muted">
          Handle requests calmly. Ask → Confirm → Done.
        </p>
      </div>
    </aside>
  );
}
