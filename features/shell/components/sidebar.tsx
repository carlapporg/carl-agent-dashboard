"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV } from "@/features/shell/nav-items";
import { cn } from "@/lib/utils/cn";

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-border bg-surface lg:flex lg:w-[18.5rem] lg:flex-col xl:w-80">
      <div className="flex h-[4.5rem] items-center border-b border-border px-7">
        <Link href={DASHBOARD_NAV[0].href} className="group block min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            Carl
          </p>
          <p className="mt-0.5 text-sm font-medium text-muted">
            Agent workspace
          </p>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-4 py-5">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-dim">
          Navigation
        </p>
        <nav className="flex flex-col gap-2" aria-label="Dashboard">
          {DASHBOARD_NAV.map((item) => {
            const active =
              item.href === DASHBOARD_NAV[0].href
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative flex items-center rounded-xl px-4 py-3.5 text-lg font-medium transition-colors",
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
                {item.label}
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
