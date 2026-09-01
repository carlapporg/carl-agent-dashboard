"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/features/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import {
  formatNotificationTime,
  hrefForNotification,
} from "@/lib/notifications/from-events";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { NotificationItem, NotificationKind } from "@/types/dashboard";

type NotifFilter = "all" | "unread" | "tasks" | "system";

const PAGE_SIZE = 4;

function isTaskKind(kind: NotificationKind) {
  return (
    kind === "task_offered" ||
    kind === "task_assigned" ||
    kind === "missed_task" ||
    kind === "waiting_for_agent" ||
    kind === "client_message" ||
    kind === "confirmation_confirmed" ||
    kind === "confirmation_declined" ||
    kind === "receipt_accepted" ||
    kind === "receipt_rejected"
  );
}

function isSystemKind(kind: NotificationKind) {
  return (
    kind === "payment_approved" ||
    kind === "payment_declined" ||
    kind === "payment_expired" ||
    kind === "task_cancelled"
  );
}

function matchesFilter(item: NotificationItem, filter: NotifFilter) {
  if (filter === "all") return true;
  if (filter === "unread") return !item.read;
  if (filter === "tasks") return isTaskKind(item.kind);
  return isSystemKind(item.kind);
}

function IconFor({ kind }: { kind: NotificationKind }) {
  if (kind === "client_message") {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </svg>
      </span>
    );
  }
  if (
    kind === "payment_approved" ||
    kind === "payment_declined" ||
    kind === "payment_expired"
  ) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-muted">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </span>
    );
  }
  if (kind === "task_cancelled" || kind === "missed_task") {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 9v4M12 17h.01M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      </svg>
    </span>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const { items, unreadCount, markAllRead, markRead } = useNotifications();
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const filters: Array<{ value: NotifFilter; label: string }> = [
    { value: "all", label: "All Alerts" },
    { value: "unread", label: `Unread (${unreadCount})` },
    { value: "tasks", label: "Tasks" },
    { value: "system", label: "System" },
  ];

  return (
    <PageShell wide>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFilter(item.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-[var(--radius-pill)] border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-foreground-soft hover:bg-surface-hover",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(ROUTES.settings)}
          >
            Notification Preferences
          </Button>
          <Button
            type="button"
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            Mark All As Read
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-4 md:px-5">
          <h2 className="text-base font-semibold text-foreground">
            Recent Updates
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Showing notifications across synced agent pipelines.
          </p>
        </div>

        {pageItems.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              No notifications yet
            </p>
            <p className="mt-1 text-sm text-muted">
              New offers, client messages, and payment results will show up
              here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pageItems.map((item) => {
              const href = hrefForNotification(item);
              return (
                <li key={item.id}>
                  <div className="flex gap-3 px-4 py-4 md:px-5">
                    <IconFor kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={href}
                          className="text-sm font-semibold text-foreground hover:text-accent"
                          onClick={() => markRead(item.id)}
                        >
                          {item.title}
                        </Link>
                        {!item.read ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {item.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <time className="text-xs text-muted-dim">
                        {formatNotificationTime(item.createdAt)}
                      </time>
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          item.read ? "bg-border" : "bg-accent",
                        )}
                        aria-hidden
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-5">
          <p className="text-sm text-muted">
            Showing {from}-{to} of {filtered.length} notifications
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2.5 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-xs font-semibold",
                    n === safePage
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-hover",
                  )}
                >
                  {n}
                </button>
              ),
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2.5 text-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
