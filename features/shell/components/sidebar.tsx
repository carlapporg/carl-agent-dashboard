import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: ROUTES.dashboard, label: "Overview", enabled: true },
  { href: "#", label: "Tasks", enabled: false },
  { href: "#", label: "Inbox", enabled: false },
  { href: "#", label: "Settings", enabled: false },
] as const;

export function DashboardSidebar() {
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
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-xl px-4 py-3 text-base transition-colors",
                "bg-surface-hover text-foreground",
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className="rounded-xl px-4 py-3 text-base text-muted-dim"
              title="Coming soon"
            >
              {item.label}
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
