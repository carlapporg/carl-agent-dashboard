"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveTasksAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { ActiveTaskSummary } from "@/types/dashboard";

export function ActiveTasksSummary() {
  const [items, setItems] = useState<ActiveTaskSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getActiveTasksAction().then((data) => {
      setItems(data);
      setLoaded(true);
    });
  }, []);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Active tasks</h2>
      <p className="mt-0.5 text-xs text-muted">
        Action-required first · unread and approvals shown separately
      </p>

      {!loaded ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-[#f8fafc] px-3 py-6 text-center text-sm text-muted">
          No active tasks — you&apos;re clear.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={ROUTES.task(item.id)}
                className={cn(
                  "block rounded-lg border px-3 py-3 transition-colors hover:bg-accent/[0.03]",
                  item.actionRequired
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-border",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      #{item.number} {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {item.customerLabel} · {item.stage}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground-soft">
                      {item.unreadCount} unread
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground-soft">
                      {item.pendingApprovalCount} approvals
                    </span>
                    {item.urgency === "urgent" || item.urgency === "high" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {item.urgency}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
