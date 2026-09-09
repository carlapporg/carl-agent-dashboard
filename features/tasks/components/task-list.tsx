"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { FilterPill } from "@/features/dashboard/components/filter-pill";
import { MissedTaskWatcher } from "@/features/tasks/components/missed-task-watcher";
import { useOps } from "@/features/ops/ops-provider";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import {
  matchesTaskHubFilter,
  taskListStatusChip,
} from "@/features/tasks/lib/workflow";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type HubFilter =
  | "all"
  | "offered"
  | "assigned"
  | "in_progress"
  | "waiting_for_customer"
  | "waiting_for_payment"
  | "completed"
  | "cancelled";

type DayFilter = "today" | "week" | "month" | "all";

const STATUS_FILTERS: Array<{ value: HubFilter; label: string }> = [
  { value: "all", label: "Status" },
  { value: "offered", label: "Offered" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting on customer" },
  { value: "waiting_for_payment", label: "Pending Payment" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const DAY_FILTERS: Array<{ value: DayFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

type TaskListProps = {
  tasks: Task[];
};

function parseHubFilter(raw: string | null): HubFilter {
  const value = (raw as HubFilter) || "all";
  if (STATUS_FILTERS.some((filter) => filter.value === value)) return value;
  if (raw === "failed") return "cancelled";
  if (raw === "queued") return "offered";
  return "all";
}

function matchesFilter(task: Task, filter: HubFilter): boolean {
  return matchesTaskHubFilter(task, filter);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function matchesDayFilter(task: Task, filter: DayFilter): boolean {
  if (filter === "all") return true;
  const updated = new Date(task.updatedAt);
  if (Number.isNaN(updated.getTime())) return true;
  const now = new Date();
  const today = startOfDay(now);
  if (filter === "today") return updated >= today;
  if (filter === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return updated >= weekAgo;
  }
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  return updated >= monthAgo;
}

function receivedTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function receivedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function taskIdLabel(task: Task, index: number): string {
  if (task.code?.trim()) {
    return task.code.startsWith("#") ? task.code : `#${task.code}`;
  }
  if (task.number) return `#${task.number}`;
  return `#${index + 1}`;
}

function titleLabel(task: Task): string {
  return (
    task.taskType?.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    task.title
  );
}

function placeLabel(task: Task): string {
  const meta =
    task.metadata && typeof task.metadata === "object"
      ? (task.metadata as Record<string, unknown>)
      : null;
  const candidates = [
    meta?.location,
    meta?.destinationCity,
    meta?.pickupCity,
    meta?.deliveryCity,
    meta?.city,
    meta?.place,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return task.customerName || "—";
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const ops = useOps();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(() =>
    parseHubFilter(searchParams.get("status")),
  );
  const [dayFilter, setDayFilter] = useState<DayFilter>("today");
  const search = searchParams.get("q") ?? "";
  const hasFilters =
    status !== "all" || dayFilter !== "all" || Boolean(search.trim());
  const [motionKey, setMotionKey] = useState(0);
  const rejectedTick = useRejectedOfferTick();
  const hydrateOpenTasks = ops?.hydrateOpenTasks;

  useEffect(() => {
    hydrateOpenTasks?.(tasks);
  }, [hydrateOpenTasks, tasks]);

  const allTasks = useMemo(
    () =>
      withoutRejectedOffers(
        mergeTaskLists(tasks, ops?.liveTasks ?? [], ops?.offer),
      ),
    [ops?.liveTasks, ops?.offer, ops?.queuePulse, rejectedTick, tasks],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter((task) => {
      if (!matchesFilter(task, status)) return false;
      if (!matchesDayFilter(task, dayFilter)) return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        task.customerName.toLowerCase().includes(q) ||
        task.request.toLowerCase().includes(q) ||
        String(task.number).includes(q) ||
        (task.taskType?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allTasks, status, dayFilter, search]);

  useEffect(() => {
    setMotionKey((k) => k + 1);
  }, [status, dayFilter, search]);

  function updateParams(next: Record<string, string>) {
    if (next.status !== undefined) setStatus(parseHubFilter(next.status));
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (!("status" in next)) {
      if (status === "all") params.delete("status");
      else params.set("status", status);
    }
    const qs = params.toString();
    const url = qs ? `${ROUTES.tasks}?${qs}` : ROUTES.tasks;
    if (next.q !== undefined || next.status === undefined) {
      startTransition(() => {
        router.push(url);
      });
      return;
    }
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className={cn("space-y-6", pending && "opacity-90")}>
      <MissedTaskWatcher tasks={allTasks} />

      {/* Figma Task Overview header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-[#1f1f21]">
            Task Overview
          </h2>
          <p className="mt-3 text-[14px] tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
            Your current sales summary and activity
          </p>
        </div>
        <AvailabilityToggle />
      </div>

      {/* Figma Live Task Queue card */}
      <section className="overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[15px] py-5">
          <h3 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            Live Task Queue
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <FilterPill
              label="Status"
              value={status}
              options={STATUS_FILTERS}
              compact
              onChange={(next) => updateParams({ status: next })}
            />
            <FilterPill
              label="Day range"
              value={dayFilter}
              options={DAY_FILTERS}
              compact
              onChange={setDayFilter}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-[#e7e7e7] px-4 py-12">
            <EmptyState
              title={
                hasFilters ? "No tasks match these filters" : "No tasks available"
              }
              description={
                hasFilters
                  ? "Try another status or clear your search to see more work."
                  : "When customers send requests, they’ll appear in this list."
              }
              action={
                hasFilters ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDayFilter("all");
                      updateParams({ status: "all", q: "", type: "all" });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto px-[15px] pb-4">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f6f6f6] text-[14px] font-medium tracking-[-0.05em] text-[#666]">
                  <th className="rounded-l-[5px] px-5 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Place</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="rounded-r-[5px] px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody key={motionKey}>
                {visible.map((task, index) => {
                  const statusChip = taskListStatusChip(task);
                  return (
                    <tr
                      key={task.id}
                      className="task-row-in border-t border-[#e7e7e7] text-[13px] font-medium tracking-[-0.03em] text-[rgba(0,16,44,0.5)] hover:bg-[#fafafa]"
                      style={{ "--row-i": index } as CSSProperties}
                    >
                      <td className="px-5 py-5">
                        {taskIdLabel(task, index)}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-5">
                        {titleLabel(task)}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-5">
                        {placeLabel(task)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-5">
                        {receivedTime(task.updatedAt)}
                      </td>
                      <td className="px-3 py-5">
                        <span
                          className={cn(
                            "inline-flex rounded-[50px] px-3.5 py-1 text-[12px] font-medium tracking-[-0.03em]",
                            statusChip.className,
                          )}
                        >
                          {statusChip.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-5">
                        {receivedDate(task.updatedAt)}
                      </td>
                      <td className="px-5 py-5">
                        <Link
                          href={ROUTES.task(task.id)}
                          className="inline-flex size-4 items-center justify-center"
                          aria-label={`Open ${task.title}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/figma/dashboard/eye.svg"
                            alt=""
                            width={15}
                            height={8}
                            className="h-[8px] w-[15px]"
                          />
                        </Link>
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
