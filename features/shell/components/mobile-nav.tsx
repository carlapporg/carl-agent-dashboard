"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DASHBOARD_NAV } from "@/features/shell/nav-items";
import { cn } from "@/lib/utils/cn";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border bg-surface lg:hidden">
      <div className="flex h-[4.5rem] items-center justify-between px-5">
        <Link href={DASHBOARD_NAV[0].href} className="block">
          <p className="text-xl font-semibold tracking-tight text-foreground">
            Carl
          </p>
          <p className="text-sm text-muted">Agent workspace</p>
        </Link>
        <button
          type="button"
          className="inline-flex h-12 items-center rounded-xl border border-border px-4 text-base font-semibold text-foreground"
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
          className="space-y-2 border-t border-border px-4 py-4"
          aria-label="Mobile"
        >
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
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-xl px-4 py-3.5 text-lg font-medium",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-foreground-soft hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
