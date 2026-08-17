"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: ROUTES.dashboard, label: "Overview" },
  { href: ROUTES.tasks, label: "Tasks" },
  { href: ROUTES.inbox, label: "Inbox" },
  { href: ROUTES.profile, label: "Profile" },
  { href: ROUTES.settings, label: "Settings" },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:flex md:flex-col lg:w-72">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link
          href={ROUTES.dashboard}
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          Carl
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 p-4" aria-label="Dashboard">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === ROUTES.dashboard
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-xl px-4 py-3 text-base transition-colors",
                active
                  ? "bg-surface-hover text-foreground"
                  : "text-muted hover:bg-surface-hover/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
