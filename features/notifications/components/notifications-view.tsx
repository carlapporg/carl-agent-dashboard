"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNotifications } from "@/features/notifications/notification-provider";
import { PageShell } from "@/components/ui/page-shell";
import {
  formatNotificationTime,
  hrefForNotification,
} from "@/lib/notifications/from-events";
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
  if (
    kind === "payment_approved" ||
    kind === "payment_declined" ||
    kind === "payment_expired"
  ) {
    return (
      <span className="relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[rgba(61,188,61,0.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/history/check.svg"
          alt=""
          width={14}
          height={14}
          className="h-[10px] w-[14px]"
        />
      </span>
    );
  }
  if (kind === "task_cancelled" || kind === "missed_task") {
    return (
      <span className="relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[rgba(84,149,253,0.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/history/lock-02.svg"
          alt=""
          width={12}
          height={12}
          className="size-3"
        />
      </span>
    );
  }
  if (kind === "client_message" || kind === "waiting_for_agent") {
    return (
      <span className="relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[rgba(0,0,0,0.06)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/dashboard/settings-gear.svg"
          alt=""
          width={14}
          height={14}
          className="size-3.5 opacity-70"
        />
      </span>
    );
  }
  return (
    <span className="relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[rgba(255,94,94,0.3)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/figma/history/alert-triangle.svg"
        alt=""
        width={12}
        height={12}
        className="size-3"
      />
    </span>
  );
}

export function NotificationsView() {
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

  const filters: Array<{ value: NotifFilter; label: string }> = [
    { value: "all", label: "All Alerts" },
    { value: "unread", label: `Unread (${unreadCount})` },
    { value: "tasks", label: "Tasks" },
    { value: "system", label: "System" },
  ];

  return (
    <PageShell wide>
      <div className="space-y-5">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
              Notification
            </h1>
            <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
              Your current sales summary and activity
            </p>
          </div>
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            className="inline-flex h-[35px] items-center rounded-[40px] border border-[#cacaca] bg-white px-[25px] text-[12px] font-medium tracking-[-0.05em] text-[#1f1f21] disabled:opacity-50"
          >
            Mark all as read
          </button>
        </section>

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
                  "inline-flex h-[35px] items-center rounded-[40px] px-4 text-[12px] font-medium tracking-[-0.05em]",
                  active
                    ? "bg-black text-white"
                    : "bg-[#f6f6f6] text-black hover:bg-[#ececec]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-white p-[25px]">
          {pageItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-[#1f1f21]">
                No notifications yet
              </p>
              <p className="mt-1 text-sm text-[rgba(0,0,0,0.5)]">
                New offers, client messages, and payment results will show up
                here.
              </p>
            </div>
          ) : (
            <ul className="space-y-[15px]">
              {pageItems.map((item) => {
                const href = hrefForNotification(item);
                return (
                  <li key={item.id}>
                    <Link
                      href={href}
                      onClick={() => markRead(item.id)}
                      className={cn(
                        "flex min-h-[103px] gap-4 rounded-[10px] border border-[#e7e7e7] bg-[#fdfdfd] px-[15px] py-5 transition-colors hover:bg-[#fafafa]",
                        !item.read && "border-[#377dff]/25",
                      )}
                    >
                      <IconFor kind={item.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="text-[16px] font-semibold leading-[19px] tracking-[-0.03em] text-[#1f1f21]">
                            {item.title}
                            {!item.read ? (
                              <span className="ml-2 inline-flex rounded-full bg-[rgba(55,125,255,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#377dff]">
                                New
                              </span>
                            ) : null}
                          </p>
                          <time className="shrink-0 text-[12px] font-medium tracking-[-0.03em] text-[rgba(0,16,44,0.5)]">
                            {formatNotificationTime(item.createdAt)}
                          </time>
                        </div>
                        <p className="mt-2 max-w-[740px] text-[13px] font-normal leading-[17px] tracking-[-0.02em] text-[rgba(0,16,44,0.5)]">
                          {item.body}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7e7e7] pt-4">
              <p className="text-sm text-[rgba(0,0,0,0.5)]">
                Page {safePage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center rounded-[40px] bg-[#f6f6f6] px-3 text-[12px] font-medium disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center rounded-[40px] bg-[#f6f6f6] px-3 text-[12px] font-medium disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
