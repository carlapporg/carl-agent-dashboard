"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatNotificationTime,
  hrefForNotification,
  kindLabel,
} from "@/lib/notifications/from-events";
import { useNotifications } from "@/features/notifications/notification-provider";
import { cn } from "@/lib/utils/cn";
import type { NotificationItem } from "@/types/dashboard";

type NotificationListProps = {
  items: NotificationItem[];
  emptyTitle?: string;
  emptyBody?: string;
  onNavigate?: () => void;
};

export function NotificationList({
  items,
  emptyTitle = "No notifications yet",
  emptyBody = "New offers, client messages, and payment results will show up here.",
  onNavigate,
}: NotificationListProps) {
  const router = useRouter();
  const { markRead, dismiss } = useNotifications();

  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const href = hrefForNotification(item);
        return (
          <li key={item.id}>
            <div
              className={cn(
                "relative flex gap-3 px-4 py-3 transition-colors hover:bg-accent/[0.04]",
                !item.read && "bg-accent/[0.03]",
              )}
            >
              {!item.read ? (
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                  aria-hidden
                />
              ) : (
                <span className="mt-1.5 size-2 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {kindLabel(item.kind)}
                  </p>
                  <time
                    className="shrink-0 text-xs tabular-nums text-muted-dim"
                    dateTime={item.createdAt}
                  >
                    {formatNotificationTime(item.createdAt)}
                  </time>
                </div>
                <Link
                  href={href}
                  className="mt-0.5 block text-sm font-semibold text-foreground hover:text-accent"
                  onClick={() => {
                    markRead(item.id);
                    onNavigate?.();
                    router.refresh();
                  }}
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
              <button
                type="button"
                className="mt-0.5 size-7 shrink-0 rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                ×
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
