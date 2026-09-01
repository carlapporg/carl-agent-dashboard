"use client";

import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { useNotifications } from "@/features/notifications/notification-provider";
import { cn } from "@/lib/utils/cn";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M15 17.5H9c-2.2 0-3.4-2.5-2.1-4.3l.4-.6c.3-.4.5-.9.5-1.4V9.8a4.2 4.2 0 0 1 8.4 0v1.4c0 .5.2 1 .5 1.4l.4.6c1.3 1.8.1 4.3-2.1 4.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 17.5v.4a2 2 0 0 0 4 0v-.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NotificationBell() {
  const { unreadCount, panelOpen, setPanelOpen } = useNotifications();
  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-foreground-soft transition-colors",
          "hover:bg-surface-hover hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          panelOpen && "border-accent/40 bg-accent-soft text-accent",
        )}
        aria-label={label}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <BellIcon className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      <NotificationPanel />
    </>
  );
}
