"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  hideActivityId,
  readHiddenActivityIds,
} from "@/lib/activity/hidden-store";
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

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      ×
    </button>
  );
}

function SelectCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate && !checked;
      }}
      aria-label={label}
      className="size-4 cursor-pointer rounded border-border accent-accent"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function LogRow({
  item,
  selected,
  onToggleSelect,
  onOpen,
  onRemove,
  index = 0,
}: {
  item: ActivityLogItem;
  selected: boolean;
  onToggleSelect: (key: string, next: boolean) => void;
  onOpen: (href: string) => void;
  onRemove: (id: string) => void;
  index?: number;
}) {
  const href = item.taskId ? ROUTES.task(item.taskId) : null;
  const visual = kindVisual(item.kind);
  const openable = Boolean(href);
  const selectKey = `log:${item.id}`;

  return (
    <tr
      className={cn(
        "task-row-in task-row-shimmer border-t border-border",
        openable && "cursor-pointer hover:bg-surface-hover",
        selected && "bg-accent-soft/40",
      )}
      style={{ "--row-i": index } as CSSProperties}
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
      <td className="w-12 px-5 py-5">
        <SelectCheckbox
          checked={selected}
          label={`Select ${item.title}`}
          onChange={(next) => onToggleSelect(selectKey, next)}
        />
      </td>
      <td className="px-3 py-5">
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
      <td className="px-3 py-5 text-right">
        <RemoveButton
          label="Remove from history"
          onClick={() => onRemove(item.id)}
        />
      </td>
    </tr>
  );
}

function AllNotifRow({
  item,
  selected,
  onToggleSelect,
  onOpen,
  onRemove,
  index = 0,
}: {
  item: NotificationItem;
  selected: boolean;
  onToggleSelect: (key: string, next: boolean) => void;
  onOpen: (item: NotificationItem) => void;
  onRemove: (id: string) => void;
  index?: number;
}) {
  const selectKey = `notif:${item.id}`;
  return (
    <tr
      className={cn(
        "task-row-in task-row-shimmer cursor-pointer border-t border-border hover:bg-surface-hover",
        selected && "bg-accent-soft/40",
      )}
      style={{ "--row-i": index } as CSSProperties}
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
      <td className="w-12 px-5 py-5">
        <SelectCheckbox
          checked={selected}
          label={`Select ${item.title}`}
          onChange={(next) => onToggleSelect(selectKey, next)}
        />
      </td>
      <td className="px-3 py-5">
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
      <td className="px-3 py-5 text-right">
        <RemoveButton
          label="Remove from history"
          onClick={() => onRemove(item.id)}
        />
      </td>
    </tr>
  );
}

export function HistoryView({ logs }: HistoryViewProps) {
  const router = useRouter();
  const ops = useOps();
  const {
    items: notifications,
    markRead,
    removeFromHistory,
  } = useNotifications();
  const [tab, setTab] = useState<HistoryTab>("all");
  const [hiddenActivityIds, setHiddenActivityIds] = useState(() =>
    readHiddenActivityIds(),
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  const mergedLogs = useMemo(() => {
    const live = ops?.liveActivities ?? [];
    const byId = new Map<string, ActivityLogItem>();
    for (const row of live) byId.set(row.id, row);
    for (const row of logs) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    return [...byId.values()]
      .filter((row) => !hiddenActivityIds.has(row.id))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [hiddenActivityIds, logs, ops?.liveActivities]);

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

  const visibleKeys = useMemo(() => {
    if (tab === "notifications") {
      return visibleNotifs.map((item) => `notif:${item.id}`);
    }
    if (tab === "all") {
      return allFeed.map((row) => row.key);
    }
    return visibleLogs.map((item) => `log:${item.id}`);
  }, [allFeed, tab, visibleLogs, visibleNotifs]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [tab]);

  const selectedCount = useMemo(
    () => visibleKeys.filter((key) => selectedKeys.has(key)).length,
    [selectedKeys, visibleKeys],
  );
  const allSelected =
    visibleKeys.length > 0 && selectedCount === visibleKeys.length;
  const someSelected = selectedCount > 0 && !allSelected;

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

  function removeActivity(id: string) {
    setHiddenActivityIds(hideActivityId(id));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(`log:${id}`);
      return next;
    });
  }

  function toggleSelect(key: string, next: boolean) {
    setSelectedKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  function toggleSelectAll(next: boolean) {
    setSelectedKeys(next ? new Set(visibleKeys) : new Set());
  }

  function deleteSelected() {
    const keys = visibleKeys.filter((key) => selectedKeys.has(key));
    if (keys.length === 0) return;
    for (const key of keys) {
      if (key.startsWith("log:")) {
        setHiddenActivityIds(hideActivityId(key.slice(4)));
      } else if (key.startsWith("notif:")) {
        removeFromHistory(key.slice(6));
      }
    }
    setSelectedKeys(new Set());
  }

  function changeTab(next: HistoryTab) {
    setTab(next);
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
            {visibleKeys.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-medium tracking-[-0.03em] text-muted">
                  <SelectCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    label="Select all"
                    onChange={toggleSelectAll}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={deleteSelected}
                  className={cn(
                    "inline-flex h-[35px] items-center justify-center rounded-[40px] px-4 text-[12px] font-medium tracking-[-0.05em]",
                    selectedCount > 0
                      ? "bg-[rgba(255,94,94,0.15)] text-[#ff5e5e] hover:bg-[rgba(255,94,94,0.25)]"
                      : "cursor-not-allowed bg-surface-muted text-muted-dim",
                  )}
                >
                  Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </button>
              </div>
            ) : null}
            {TABS.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => changeTab(item.value)}
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
                    <th className="w-12 px-5 py-2.5 first:rounded-l-[5px]">
                      <SelectCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        label="Select all notifications"
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-2.5">Notification</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-3 py-2.5 last:rounded-r-[5px]">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNotifs.map((item, index) => {
                    const key = `notif:${item.id}`;
                    const selected = selectedKeys.has(key);
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "task-row-in task-row-shimmer cursor-pointer border-t border-border hover:bg-surface-hover",
                          selected && "bg-accent-soft/40",
                        )}
                        style={{ "--row-i": index } as CSSProperties}
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
                        <td className="w-12 px-5 py-5">
                          <SelectCheckbox
                            checked={selected}
                            label={`Select ${item.title}`}
                            onChange={(next) => toggleSelect(key, next)}
                          />
                        </td>
                        <td className="px-3 py-5">
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
                        <td className="px-3 py-5 text-right">
                          <RemoveButton
                            label="Remove from history"
                            onClick={() => {
                              removeFromHistory(item.id);
                              toggleSelect(key, false);
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
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
                    <th className="w-12 px-5 py-2.5 first:rounded-l-[5px]">
                      <SelectCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        label="Select all activity"
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-2.5">Event</th>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-3 py-2.5 last:rounded-r-[5px]">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allFeed.map((row, index) =>
                    row.source === "log" ? (
                      <LogRow
                        key={row.key}
                        item={row.log}
                        index={index}
                        selected={selectedKeys.has(row.key)}
                        onToggleSelect={toggleSelect}
                        onOpen={(href) => router.push(href)}
                        onRemove={removeActivity}
                      />
                    ) : (
                      <AllNotifRow
                        key={row.key}
                        item={row.notif}
                        index={index}
                        selected={selectedKeys.has(row.key)}
                        onToggleSelect={toggleSelect}
                        onOpen={openNotification}
                        onRemove={removeFromHistory}
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
                  <th className="w-12 px-5 py-2.5 first:rounded-l-[5px]">
                    <SelectCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      label="Select all hand-overs"
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-3 py-2.5 last:rounded-r-[5px]">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((item, index) => (
                  <LogRow
                    key={item.id}
                    item={item}
                    index={index}
                    selected={selectedKeys.has(`log:${item.id}`)}
                    onToggleSelect={toggleSelect}
                    onOpen={(href) => router.push(href)}
                    onRemove={removeActivity}
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
