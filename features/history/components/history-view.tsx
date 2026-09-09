"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { useOps } from "@/features/ops/ops-provider";
import {
  type ActivityLogFilter,
  type ActivityLogItem,
  type ActivityLogKind,
} from "@/lib/api/activity-logs";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

type HistoryViewProps = {
  logs: ActivityLogItem[];
};

/** Figma order: Agent Hand-Over → System Alerts → All Activity (active black) */
const FILTERS: Array<{ value: ActivityLogFilter; label: string }> = [
  { value: "handover", label: "Agent Hand-Over" },
  { value: "system", label: "System Alerts" },
  { value: "all", label: "All Activity" },
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
        titleClass: "text-[#377dff]",
        circleClass: "bg-[rgba(84,149,253,0.2)]",
        iconSrc: "/figma/history/lock-02.svg",
        iconClass: "size-5",
      };
    case "task_status":
      return {
        titleClass: "text-[#377dff]",
        circleClass: "bg-[rgba(84,149,253,0.2)]",
        iconSrc: "/figma/history/file-subtract.svg",
        iconClass: "size-5",
      };
    case "handover":
    case "system":
    default:
      return {
        titleClass: "text-[#377dff]",
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

export function HistoryView({ logs }: HistoryViewProps) {
  const router = useRouter();
  const ops = useOps();
  const [filter, setFilter] = useState<ActivityLogFilter>("all");

  const visible = useMemo(
    () => logs.filter((item) => matchesFilter(item, filter)),
    [filter, logs],
  );

  const sectionTitle =
    FILTERS.find((item) => item.value === filter)?.label ?? "All Activity";

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

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f21]">
            History
          </h1>
          <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
            Your current sales summary and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AvailabilityToggle activeTaskCount={activeTaskCount} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
          <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            {sectionTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex h-[35px] items-center justify-center rounded-[40px] px-[25px] text-[12px] font-medium tracking-[-0.05em]",
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
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-[#e7e7e7] px-4 py-12 md:px-5">
            <EmptyState
              title="No activity yet"
              description="Workspace events and audit trails will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f6f6f6] text-[14px] font-medium tracking-[-0.05em] text-[#666]">
                  <th className="px-5 py-2.5 first:rounded-l-[5px]">TRX ID</th>
                  <th className="px-3 py-2.5">TRX ID</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-5 py-2.5 last:rounded-r-[5px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const href = item.taskId ? ROUTES.task(item.taskId) : null;
                  const visual = kindVisual(item.kind);
                  const openable = Boolean(href);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-t border-[#e7e7e7]",
                        openable && "cursor-pointer hover:bg-[#fafafa]",
                      )}
                      onClick={
                        href
                          ? () => router.push(href)
                          : undefined
                      }
                      onKeyDown={
                        href
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(href);
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
                            <p className="mt-1.5 max-w-[377px] truncate text-[12px] font-normal tracking-[-0.03em] text-[rgba(0,16,44,0.5)]">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-[rgba(0,16,44,0.5)]">
                        {item.taskLabel ?? "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-5 text-[12px] font-normal tracking-[-0.03em] text-[rgba(0,16,44,0.5)]">
                        {item.actor}
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-[12px] font-normal tracking-[-0.03em] text-[rgba(0,16,44,0.5)]">
                        <time dateTime={item.at}>{formatLogTime(item.at)}</time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
