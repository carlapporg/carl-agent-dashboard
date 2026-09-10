"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useNotifications } from "@/features/notifications/notification-provider";
import { useOps } from "@/features/ops/ops-provider";
import {
  type ActivityLogFilter,
  type ActivityLogItem,
  type ActivityLogKind,
} from "@/lib/activity/parse-api";
import {
  formatNotificationTime,
  hrefForNotification,
  kindLabel,
} from "@/lib/notifications/from-events";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { NotificationItem, NotificationKind } from "@/types/dashboard";

type HistoryViewProps = {
  logs: ActivityLogItem[];
};

type HistoryTab = ActivityLogFilter | "notifications";

/** Hand-Over + All Activity + Notifications (System Alerts hidden until API ships). */
const TABS: Array<{ value: HistoryTab; label: string }> = [
  { value: "handover", label: "Agent Hand-Over" },
  { value: "all", label: "All Activity" },
  { value: "notifications", label: "Notifications" },
];

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date >= startToday) return `Today, ${time}`;
  if (date >= startYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesFilter(item: ActivityLogItem, filter: ActivityLogFilter) {
  if (filter === "all") return true;
  if (filter === "system") {
    return (
      item.kind === "system" ||
      item.kind === "alert" ||
      item.kind === "voucher"
    );
  }
  return item.kind === "handover";
}

type KindVisual = {
  titleClass: string;
  circleClass: string;
  iconSrc: string;
  iconClass: string;
};

function kindVisual(kind: ActivityLogKind): KindVisual {
  switch (kind) {
    case "alert":
      return {
        titleClass: "text-[#fd4438]",
        circleClass: "bg-[rgba(255,94,94,0.3)]",
        iconSrc: "/figma/history/alert-triangle.svg",
        iconClass: "size-5",
      };
    case "payment":
      return {
        titleClass: "text-[#3dbc3d]",
        circleClass: "bg-[rgba(61,188,61,0.2)]",
        iconSrc: "/figma/history/check.svg",
        iconClass: "h-[13.5px] w-[18.5px]",
      };
    case "voucher":
      return {
        titleClass: "text-accent",
        circleClass: "bg-[rgba(84,149,253,0.2)]",
        iconSrc: "/figma/history/lock-02.svg",
        iconClass: "size-5",
      };
    case "task_status":
      return {
        titleClass: "text-accent",
        circleClass: "bg-[rgba(84,149,253,0.2)]",
        iconSrc: "/figma/history/file-subtract.svg",
        iconClass: "size-5",
      };
    case "handover":
    case "system":
    default:
      return {
        titleClass: "text-accent",
        circleClass: "bg-[rgba(84,149,253,0.2)]",
        iconSrc: "/figma/history/file-subtract.svg",
        iconClass: "size-5",
      };
  }
}

function KindIcon({ kind }: { kind: ActivityLogKind }) {
  const visual = kindVisual(kind);
  return (
    <span
      className={cn(
        "relative flex size-[50px] shrink-0 items-center justify-center rounded-full",
        visual.circleClass,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visual.iconSrc}
        alt=""
        width={20}
        height={20}
        className={visual.iconClass}
      />
    </span>
  );
}

function NotifIcon({ kind }: { kind: NotificationKind }) {
  if (
    kind === "payment_approved" ||
    kind === "payment_declined" ||
    kind === "payment_expired"
  ) {
    return (
      <span className="relative flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[rgba(61,188,61,0.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/history/check.svg"
          alt=""
          width={18}
          height={14}
          className="h-[13.5px] w-[18.5px]"
        />
      </span>
    );
  }
  if (
    kind === "task_cancelled" ||
    kind === "task_failed" ||
    kind === "missed_task"
  ) {
    return (
      <span className="relative flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[rgba(255,94,94,0.3)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/history/alert-triangle.svg"
          alt=""
          width={20}
          height={20}
          className="size-5"
        />
      </span>
    );
  }
  return (
    <span className="relative flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[rgba(84,149,253,0.2)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/figma/history/file-subtract.svg"
        alt=""
        width={20}
        height={20}
        className="size-5"
      />
    </span>
  );
}

type AllFeedRow =
  | { key: string; at: string; source: "log"; log: ActivityLogItem }
  | { key: string; at: string; source: "notif"; notif: NotificationItem };

function LogRow({
  item,
  onOpen,
}: {
  item: ActivityLogItem;
  onOpen: (href: string) => void;
}) {
  const href = item.taskId ? ROUTES.task(item.taskId) : null;
  const visual = kindVisual(item.kind);
  const openable = Boolean(href);

  return (
    <tr
      className={cn(
        "border-t border-border",
        openable && "cursor-pointer hover:bg-surface-hover",
      )}
      onClick={href ? () => onOpen(href) : undefined}
      onKeyDown={
        href
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(href);
              }
            }
          : undefined
      }
      tabIndex={openable ? 0 : undefined}
      role={openable ? "link" : undefined}
    >
      <td className="px-5 py-5">
        <div className="flex items-start gap-[15px]">
          <KindIcon kind={item.kind} />
          <div className="min-w-0 pt-1.5">
            <p
              className={cn(
                "text-[14px] font-semibold leading-none tracking-[-0.03em]",
                visual.titleClass,
              )}
            >
              {item.title}
            </p>
            <p className="mt-1.5 max-w-[377px] truncate text-[12px] font-normal tracking-[-0.03em] text-muted">
              {item.body}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        {item.taskLabel ?? "—"}
      </td>
      <td className="max-w-[140px] truncate px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        {item.actor ?? "—"}
      </td>
      <td className="whitespace-nowrap px-5 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        <time dateTime={item.at}>{formatLogTime(item.at)}</time>
      </td>
    </tr>
  );
}

function AllNotifRow({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  return (
    <tr
      className="cursor-pointer border-t border-border hover:bg-surface-hover"
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      tabIndex={0}
      role="link"
    >
      <td className="px-5 py-5">
        <div className="flex items-start gap-[15px]">
          <NotifIcon kind={item.kind} />
          <div className="min-w-0 pt-1.5">
            <p
              className={cn(
                "text-[14px] font-semibold leading-none tracking-[-0.03em] text-foreground",
                !item.read && "text-accent",
              )}
            >
              {item.title}
            </p>
            <p className="mt-1.5 max-w-[377px] truncate text-[12px] font-normal tracking-[-0.03em] text-muted">
              {item.body}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        —
      </td>
      <td className="max-w-[140px] truncate px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        {kindLabel(item.kind)}
      </td>
      <td className="whitespace-nowrap px-5 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
        <time dateTime={item.createdAt}>{formatLogTime(item.createdAt)}</time>
      </td>
    </tr>
  );
}

export function HistoryView({ logs }: HistoryViewProps) {
  const router = useRouter();
  const ops = useOps();
  const { items: notifications, markRead } = useNotifications();
  const [tab, setTab] = useState<HistoryTab>("all");

  const mergedLogs = useMemo(() => {
    const live = ops?.liveActivities ?? [];
    if (live.length === 0) return logs;
    const byId = new Map<string, ActivityLogItem>();
    for (const row of live) byId.set(row.id, row);
    for (const row of logs) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    return [...byId.values()].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [logs, ops?.liveActivities]);

  const visibleLogs = useMemo(() => {
    if (tab === "notifications" || tab === "all") return [];
    return mergedLogs.filter((item) => matchesFilter(item, tab));
  }, [mergedLogs, tab]);

  const visibleNotifs = useMemo(() => {
    if (tab !== "notifications") return [];
    return [...notifications].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [notifications, tab]);

  const allFeed = useMemo(() => {
    if (tab !== "all") return [] as AllFeedRow[];
    const rows: AllFeedRow[] = [
      ...mergedLogs.map((log) => ({
        key: `log:${log.id}`,
        at: log.at,
        source: "log" as const,
        log,
      })),
      ...notifications.map((notif) => ({
        key: `notif:${notif.id}`,
        at: notif.createdAt,
        source: "notif" as const,
        notif,
      })),
    ];
    return rows.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [mergedLogs, notifications, tab]);

  const sectionTitle =
    TABS.find((item) => item.value === tab)?.label ?? "All Activity";

  const activeTaskCount = useMemo(() => {
    const live = ops?.liveTasks ?? [];
    return live.filter(
      (t) =>
        !t.parentId &&
        (t.backendStatus === "OFFERED" ||
          t.backendStatus === "ASSIGNED" ||
          t.backendStatus === "IN_PROGRESS" ||
          t.backendStatus === "WAITING_FOR_USER" ||
          t.backendStatus === "WAITING_FOR_AGENT"),
    ).length;
  }, [ops?.liveTasks]);

  function openNotification(item: NotificationItem) {
    if (!item.read) markRead(item.id);
    router.push(hrefForNotification(item));
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
            History
          </h1>
          <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-muted">
            Your current sales summary and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AvailabilityToggle activeTaskCount={activeTaskCount} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
          <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
            {sectionTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {TABS.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "inline-flex h-[35px] items-center justify-center rounded-[40px] px-[25px] text-[12px] font-medium tracking-[-0.05em]",
                    active
                      ? "bg-black text-accent-foreground"
                      : "bg-surface-muted text-foreground hover:bg-surface-hover",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "notifications" ? (
          visibleNotifs.length === 0 ? (
            <div className="border-t border-border px-4 py-12 md:px-5">
              <EmptyState
                title="No notifications yet"
                description="Offers, messages, and alerts will show up here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-muted">
                    <th className="px-5 py-2.5 first:rounded-l-[5px]">
                      Notification
                    </th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-5 py-2.5 last:rounded-r-[5px]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNotifs.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-t border-border hover:bg-surface-hover"
                      onClick={() => openNotification(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openNotification(item);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                    >
                      <td className="px-5 py-5">
                        <div className="flex items-start gap-[15px]">
                          <NotifIcon kind={item.kind} />
                          <div className="min-w-0 pt-1.5">
                            <p
                              className={cn(
                                "text-[14px] font-semibold leading-none tracking-[-0.03em] text-foreground",
                                !item.read && "text-accent",
                              )}
                            >
                              {item.title}
                            </p>
                            <p className="mt-1.5 max-w-[377px] truncate text-[12px] font-normal tracking-[-0.03em] text-muted">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
                        {kindLabel(item.kind)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
                        {item.read ? "Read" : "Unread"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-[12px] font-normal tracking-[-0.03em] text-muted">
                        <time dateTime={item.createdAt}>
                          {formatNotificationTime(item.createdAt)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "all" ? (
          allFeed.length === 0 ? (
            <div className="border-t border-border px-4 py-12 md:px-5">
              <EmptyState
                title="No activity yet"
                description="Hand-overs, task updates, and notifications will show up here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-muted">
                    <th className="px-5 py-2.5 first:rounded-l-[5px]">Event</th>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-5 py-2.5 last:rounded-r-[5px]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allFeed.map((row) =>
                    row.source === "log" ? (
                      <LogRow
                        key={row.key}
                        item={row.log}
                        onOpen={(href) => router.push(href)}
                      />
                    ) : (
                      <AllNotifRow
                        key={row.key}
                        item={row.notif}
                        onOpen={openNotification}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : visibleLogs.length === 0 ? (
          <div className="border-t border-border px-4 py-12 md:px-5">
            <EmptyState
              title="No activity yet"
              description="Hand-overs from the queue manager will show up here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-muted">
                  <th className="px-5 py-2.5 first:rounded-l-[5px]">Event</th>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-5 py-2.5 last:rounded-r-[5px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((item) => (
                  <LogRow
                    key={item.id}
                    item={item}
                    onOpen={(href) => router.push(href)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
