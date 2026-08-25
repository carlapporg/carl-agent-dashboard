"use client";

import { NotificationList } from "@/features/notifications/components/notification-list";
import { useNotifications } from "@/features/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";

export function NotificationsView() {
  const { items, unreadCount, markAllRead } = useNotifications();

  return (
    <PageShell wide>
      <PageHeader
        title="Notifications"
        description="Offers, client messages, payment results, and other task updates."
        className="mb-5 sm:mb-6"
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {unreadCount === 0
            ? "No unread notifications."
            : `${unreadCount} unread`}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={unreadCount === 0}
          onClick={markAllRead}
        >
          Mark all as read
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <NotificationList items={items} />
      </Card>
    </PageShell>
  );
}
