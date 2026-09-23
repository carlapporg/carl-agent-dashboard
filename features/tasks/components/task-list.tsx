"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
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
import { EyeIcon } from "@/components/ui/eye-icon";
import { ROUTES } from "@/lib/constants/routes";
import {
  matchesLiveDayFilter,
  type LiveDayFilter,
} from "@/lib/dashboard/live-queue";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import {
  confirmationFromCache,
  matchesTaskHubFilter,
  receiptFromCache,
  taskListStatusChip,
} from "@/features/tasks/lib/workflow";
import { useHydrateTaskConfirmations } from "@/features/tasks/hooks/use-hydrate-task-confirmations";
import { taskPlaceLabel } from "@/lib/tasks/place-label";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";
import type { TaskConfirmation } from "@/types/confirmation";
import type { TaskReceipt } from "@/types/receipt";

type HubFilter =
  | "all"
  | "offered"
  | "assigned"
  | "in_progress"
  | "waiting_for_customer"
  | "waiting_for_payment"
  | "completed"
  | "cancelled";

type DayFilter = LiveDayFilter;

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

const DAY_FILTER_STORAGE_KEY = "carl.agent.task-hub-day";

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

function parseDayFilter(raw: string | null | undefined): DayFilter {
  if (raw === "today" || raw === "week" || raw === "month" || raw === "all") {
    return raw;
  }
  return "today";
}

function readStoredDayFilter(): DayFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DAY_FILTER_STORAGE_KEY);
    if (!raw) return null;
    return parseDayFilter(raw);
  } catch {
    return null;
  }
}

function writeStoredDayFilter(value: DayFilter) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DAY_FILTER_STORAGE_KEY, value);
  } catch {
    // Private mode / quota — ignore.
  }
}

function matchesFilter(
  task: Task,
  filter: HubFilter,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): boolean {
  return matchesTaskHubFilter(task, filter, confirmation, receipt);
}

function matchesDayFilter(task: Task, filter: DayFilter): boolean {
  return matchesLiveDayFilter(task, filter);
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

function titleLabel(task: Task): string {
  return (
    task.taskType?.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    task.title
  );
}

function placeLabel(task: Task): string {
  return taskPlaceLabel(task);
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const ops = useOps();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(() =>
    parseHubFilter(searchParams.get("status")),
  );
  const [dayFilter, setDayFilter] = useState<DayFilter>(() => {
    const fromUrl = parseDayFilter(searchParams.get("day"));
    if (searchParams.get("day")) return fromUrl;
    return readStoredDayFilter() ?? "today";
  });
  const search = searchParams.get("q") ?? "";
  const hasFilters =
    status !== "all" || dayFilter !== "today" || Boolean(search.trim());
  const rejectedTick = useRejectedOfferTick();
  const hydrateOpenTasks = ops?.hydrateOpenTasks;

  useEffect(() => {
    hydrateOpenTasks?.(tasks);
  }, [hydrateOpenTasks, tasks]);

  // Restore day filter after client mount (SSR can't read sessionStorage).
  useEffect(() => {
    const fromUrl = searchParams.get("day");
    if (fromUrl) {
      const parsed = parseDayFilter(fromUrl);
      setDayFilter(parsed);
      writeStoredDayFilter(parsed);
      return;
    }
    const stored = readStoredDayFilter();
    if (stored) setDayFilter(stored);
  }, [searchParams]);

  const allTasks = useMemo(
    () =>
      withoutRejectedOffers(
        mergeTaskLists(tasks, ops?.liveTasks ?? [], ops?.offer),
      ),
    // queuePulse is intentionally omitted — liveTasks/offer already update.
    [ops?.liveTasks, ops?.offer, rejectedTick, tasks],
  );

  const confirmationsByTaskId = ops?.confirmationsByTaskId;
  const receiptsByTaskId = ops?.receiptsByTaskId;

  useHydrateTaskConfirmations(allTasks);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter((task) => {
      const confirmation = confirmationFromCache(confirmationsByTaskId, task.id);
      const receipt = receiptFromCache(receiptsByTaskId, task.id);
      if (!matchesFilter(task, status, confirmation, receipt)) return false;
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
  }, [
    allTasks,
    confirmationsByTaskId,
    dayFilter,
    receiptsByTaskId,
    search,
    status,
  ]);

  function updateParams(next: Record<string, string>) {
    if (next.status !== undefined) setStatus(parseHubFilter(next.status));
    if (next.day !== undefined) {
      const parsed = parseDayFilter(next.day);
      setDayFilter(parsed);
      writeStoredDayFilter(parsed);
    }
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      // Status "all" clears the param; day "today" is the default and clears too.
      // Day "all" means all-time and must stay in the URL.
      if (key === "day") {
        if (!value || value === "today") params.delete("day");
        else params.set("day", value);
        continue;
      }
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (!("status" in next)) {
      if (status === "all") params.delete("status");
      else params.set("status", status);
    }
    if (!("day" in next)) {
      if (dayFilter === "today") params.delete("day");
      else params.set("day", dayFilter);
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
          <h2 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-foreground">
            Task Overview
          </h2>
        </div>
        <AvailabilityToggle />
      </div>

      {/* Figma Live Task Queue card */}
      <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[15px] py-5">
          <h3 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
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
              onChange={(next) => updateParams({ day: next })}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-border px-4 py-12">
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
                      writeStoredDayFilter("today");
                      setDayFilter("today");
                      updateParams({ status: "all", q: "", type: "all", day: "today" });
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
                <tr className="bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-muted">
                  <th className="rounded-l-[5px] px-5 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Place</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="rounded-r-[5px] px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((task, index) => {
                  const confirmation = confirmationFromCache(
                    confirmationsByTaskId,
                    task.id,
                  );
                  const receipt = receiptFromCache(receiptsByTaskId, task.id);
                  const statusChip = taskListStatusChip(
                    task,
                    confirmation,
                    receipt,
                  );
                  return (
                    <tr
                      key={task.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer border-t border-border text-[13px] font-medium tracking-[-0.03em] text-muted hover:bg-surface-hover"
                      onClick={() => router.push(ROUTES.task(task.id))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(ROUTES.task(task.id));
                        }
                      }}
                    >
                      <td className="px-5 py-5">#{index + 1}</td>
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
                          className="inline-flex size-4 items-center justify-center text-muted hover:text-foreground"
                          aria-label={`Open ${task.title}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <EyeIcon />
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
