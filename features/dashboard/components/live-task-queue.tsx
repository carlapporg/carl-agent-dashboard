"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { OfferActions } from "@/features/dashboard/components/offer-actions";
import { EyeIcon } from "@/components/ui/eye-icon";
import {
  MonthFilterPill,
  type MonthFilterValue,
} from "@/features/dashboard/components/month-filter-pill";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { isPendingReject } from "@/features/ops/rejected-offers";
import {
  isRejectingOrRejected,
  hasOpenRejectUi,
} from "@/features/ops/auto-accept-offer";
import { offerWindowEnd } from "@/types/agent";
import { isCompletedQueueTask } from "@/lib/dashboard/live-queue";
import {
  confirmationFromCache,
  receiptFromCache,
  taskListStatusChip,
} from "@/features/tasks/lib/workflow";
import { useHydrateTaskConfirmations } from "@/features/tasks/hooks/use-hydrate-task-confirmations";
import { taskPlaceLabel } from "@/lib/tasks/place-label";
import type { Task } from "@/types/task";
import type { TaskConfirmation } from "@/types/confirmation";
import type { TaskReceipt } from "@/types/receipt";

type LiveTaskQueueProps = {
  /** Pre-filtered open tasks (same list Task Progress uses). */
  items: Task[];
  rangeLabel?: MonthFilterValue;
  onRangeChange?: (value: MonthFilterValue) => void;
};

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

function placeLabel(task: Task): string {
  return taskPlaceLabel(task);
}

function statusBadgeLabel(
  task: Task,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): string {
  if (isRejectingOrRejected(task.id) || isPendingReject(task.id)) {
    return "Rejecting";
  }
  const chip = taskListStatusChip(task, confirmation, receipt);
  if (chip.label === "Pending") return "Offered";
  if (chip.label === "Waiting on Cust") return "Waiting For Customer";
  if (chip.label === "Pending Payment") return "Waiting For Payment";
  return chip.label;
}

function chipTone(
  task: Task,
  confirmation?: TaskConfirmation | null,
  receipt?: TaskReceipt | null,
): string {
  return taskListStatusChip(task, confirmation, receipt).className;
}

/** Assigned / active / completed tasks open on click — offers stay for Accept/Reject. */
function canOpenTask(task: Task): boolean {
  return (
    task.backendStatus === "ASSIGNED" ||
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "WAITING_FOR_USER" ||
    task.backendStatus === "WAITING_FOR_AGENT" ||
    task.backendStatus === "COMPLETED" ||
    task.status === "assigned" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "completed"
  );
}

export function LiveTaskQueue({
  items,
  rangeLabel,
  onRangeChange,
}: LiveTaskQueueProps) {
  const ops = useOps();
  const router = useRouter();
  const [highlight, setHighlight] = useState(false);
  const prevIds = useRef<Set<string>>(new Set(items.map((t) => t.id)));
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const confirmationsByTaskId = ops?.confirmationsByTaskId;
  const receiptsByTaskId = ops?.receiptsByTaskId;

  useHydrateTaskConfirmations(items);

  useEffect(() => {
    const next = new Set(items.map((t) => t.id));
    const added = items
      .filter((t) => !prevIds.current.has(t.id))
      .map((t) => t.id);
    prevIds.current = next;
    if (added.length === 0) return;
    setNewIds(new Set(added));
    setHighlight(true);
    const id = window.setTimeout(() => {
      setHighlight(false);
      setNewIds(new Set());
    }, 1800);
    return () => window.clearTimeout(id);
  }, [items]);

  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
            Live Task Queue
          </h2>
          <span
            className={cn(
              "relative inline-flex items-center gap-2 rounded-[50px] bg-[rgba(61,188,61,0.2)] py-1 pl-6 pr-4 text-[12px] font-medium tracking-[-0.03em] text-[#3dbc3d]",
              (ops?.livePulse || highlight) && "dash-live-badge-pop",
            )}
          >
            <span className="dash-live-dot absolute left-3.5 top-1/2 size-[5px] -translate-y-1/2 rounded-full bg-[#3dbc3d]" />
            {items.length} Live Task
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthFilterPill value={rangeLabel} onChange={onRangeChange} />
          <Link
            href={ROUTES.tasks}
            className="inline-flex h-[35px] items-center rounded-[40px] bg-accent-soft px-6 text-[12px] font-medium tracking-[-0.05em] text-accent"
          >
            Open full queue
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border-t border-border px-4 py-12 text-center text-sm text-muted">
          Queue is quiet. New assignments will appear here live.
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[640px] w-full border-collapse text-left md:min-w-[760px] xl:min-w-[920px]">
            <thead>
              <tr className="bg-surface-muted text-[12px] font-medium tracking-[-0.05em] text-muted sm:text-[14px]">
                <th className="px-3 py-2.5 first:rounded-l-[5px] sm:px-5">ID</th>
                <th className="px-3 py-2.5">Task</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Place</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Date</th>
                <th className="px-3 py-2.5 last:rounded-r-[5px] sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isNew = newIds.has(item.id);
                const offered =
                  item.backendStatus === "OFFERED" || hasOpenRejectUi(item.id);
                const openable = canOpenTask(item);
                const confirmation = confirmationFromCache(
                  confirmationsByTaskId,
                  item.id,
                );
                const receipt = receiptFromCache(receiptsByTaskId, item.id);
                const label = statusBadgeLabel(item, confirmation, receipt);

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "task-row-in task-row-shimmer border-t border-border text-[13px] font-medium tracking-[-0.03em] text-muted",
                      isNew && "bg-accent-soft",
                      openable && "cursor-pointer hover:bg-surface-hover",
                    )}
                    style={{ "--row-i": index } as CSSProperties}
                    onClick={
                      openable
                        ? () => router.push(ROUTES.task(item.id))
                        : undefined
                    }
                    onKeyDown={
                      openable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(ROUTES.task(item.id));
                            }
                          }
                        : undefined
                    }
                    tabIndex={openable ? 0 : undefined}
                    role={openable ? "link" : undefined}
                  >
                    <td className="px-3 py-5 sm:px-5">#{index + 1}</td>
                    <td className="max-w-[180px] truncate px-3 py-5">
                      {item.taskType?.replaceAll("_", " ") ?? item.title}
                    </td>
                    <td className="hidden max-w-[140px] truncate px-3 py-5 sm:table-cell">
                      {placeLabel(item)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5">
                      {receivedTime(
                        isCompletedQueueTask(item)
                          ? (item.completedAt ?? item.updatedAt)
                          : item.updatedAt,
                      )}
                    </td>
                    <td className="px-3 py-5">
                      <div
                        className="flex flex-col items-start gap-2"
                        onClick={(event) => {
                          if (offered) event.stopPropagation();
                        }}
                      >
                        <span
                          className={cn(
                            "inline-flex rounded-[50px] px-3.5 py-1 text-[12px] font-medium tracking-[-0.03em]",
                            chipTone(item, confirmation, receipt),
                          )}
                        >
                          {label}
                        </span>
                        {offered ? (
                          <OfferCountdown
                            expiresAt={offerWindowEnd(item)}
                            taskId={item.id}
                            autoAccept
                          />
                        ) : null}
                        {offered ? <OfferActions task={item} /> : null}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-5 md:table-cell">
                      {receivedDate(
                        isCompletedQueueTask(item)
                          ? (item.completedAt ?? item.updatedAt)
                          : item.updatedAt,
                      )}
                    </td>
                    <td className="px-3 py-5 sm:px-5">
                      <Link
                        href={ROUTES.task(item.id)}
                        className="inline-flex size-4 items-center justify-center text-muted hover:text-foreground"
                        aria-label={`Open ${item.title}`}
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
  );
}
