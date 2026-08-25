"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { useNotifications } from "@/features/notifications/notification-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

export function NotificationPanel() {
  const {
    items,
    unreadCount,
    panelOpen,
    setPanelOpen,
    markAllRead,
    prefs,
    setPrefs,
  } = useNotifications();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.focus();
  }, [panelOpen]);

  if (!panelOpen) return null;

  return (
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/20"
        aria-label="Close notifications"
        onClick={() => setPanelOpen(false)}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-[var(--shadow-soft)] outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              Notifications
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {unreadCount === 0
                ? "You’re all caught up."
                : `${unreadCount} unread`}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface-hover"
            onClick={() => setPanelOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            className="text-sm font-semibold text-accent hover:text-accent-hover disabled:text-muted disabled:no-underline"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </button>
          <button
            type="button"
            className={cn(
              "text-sm font-medium",
              prefs.sound ? "text-foreground-soft" : "text-muted",
            )}
            onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
          >
            Sound {prefs.sound ? "on" : "off"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotificationList
            items={items}
            onNavigate={() => setPanelOpen(false)}
          />
        </div>

        <div className="border-t border-border px-4 py-3">
          <Link
            href={ROUTES.notifications}
            className="text-sm font-semibold text-accent hover:text-accent-hover"
            onClick={() => setPanelOpen(false)}
          >
            Open all notifications
          </Link>
        </div>
      </aside>
    </div>
  );
}
