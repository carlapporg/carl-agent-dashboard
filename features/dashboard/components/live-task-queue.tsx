"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { OfferActions } from "@/features/dashboard/components/offer-actions";
import { MonthFilterPill } from "@/features/dashboard/components/month-filter-pill";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import {
  isPendingReject,
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import {
  isRejectingOrRejected,
  hasOpenRejectUi,
} from "@/features/ops/auto-accept-offer";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import { offerWindowEnd } from "@/types/agent";
import type { Task } from "@/types/task";

type LiveTaskQueueProps = {
  seedTasks: Task[];
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

function statusBadgeLabel(task: Task): string {
  if (isRejectingOrRejected(task.id) || isPendingReject(task.id)) {
    return "Rejecting";
  }
  if (task.status === "waiting_for_payment") return "Waiting For Payment";
  if (task.status === "waiting_for_customer") return "Waiting For Customer";
  if (task.backendStatus === "OFFERED") return "Offered";
  if (task.backendStatus === "ASSIGNED") return "Assigned";
  if (task.backendStatus === "WAITING_FOR_USER") return "Waiting For Customer";
  if (task.backendStatus === "IN_PROGRESS") return "In Progress";
  if (task.backendStatus === "WAITING_FOR_AGENT") return "In Progress";
  if (task.status === "cancelled") return "Failed";
  return task.status.replaceAll("_", " ");
}

function chipTone(task: Task): string {
  if (task.backendStatus === "ASSIGNED") {
    return "bg-[rgba(111,186,0,0.2)] text-[#6fba00]";
  }
  if (
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment" ||
    task.backendStatus === "OFFERED" ||
    task.backendStatus === "WAITING_FOR_USER"
  ) {
    return "bg-[rgba(245,158,11,0.18)] text-[#b45309]";
  }
  if (task.status === "in_progress" || task.backendStatus === "IN_PROGRESS") {
    return "bg-[rgba(84,149,253,0.2)] text-[#5072e8]";
  }
  return "bg-[#f2f4f7] text-[#667085]";
}

/** Assigned / active tasks open on click — offers stay for Accept/Reject. */
function canOpenTask(task: Task): boolean {
  return (
    task.backendStatus === "ASSIGNED" ||
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "WAITING_FOR_USER" ||
    task.backendStatus === "WAITING_FOR_AGENT" ||
    task.status === "assigned" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer"
  );
}

export function LiveTaskQueue({ seedTasks }: LiveTaskQueueProps) {
  const ops = useOps();
  const router = useRouter();
  const [highlight, setHighlight] = useState(false);
  const prevIds = useRef<Set<string>>(new Set(seedTasks.map((t) => t.id)));
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const rejectedTick = useRejectedOfferTick();

  const items = useMemo(() => {
    return withoutRejectedOffers(
      mergeTaskLists(seedTasks, ops?.liveTasks ?? [], ops?.offer),
    )
      .filter((t) => !t.parentId)
      .filter(
        (t) =>
          t.backendStatus === "OFFERED" ||
          t.backendStatus === "ASSIGNED" ||
          t.backendStatus === "IN_PROGRESS" ||
          t.backendStatus === "WAITING_FOR_USER" ||
          t.backendStatus === "WAITING_FOR_AGENT" ||
          t.status === "queued" ||
          t.status === "assigned" ||
          t.status === "in_progress" ||
          t.status === "waiting_for_customer",
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [ops?.liveTasks, ops?.offer, ops?.queuePulse, rejectedTick, seedTasks]);

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
  }, [items, ops?.queuePulse]);

  useEffect(() => {
    if (!ops?.queuePulse) return;
    setHighlight(true);
    const id = window.setTimeout(() => setHighlight(false), 1400);
    return () => window.clearTimeout(id);
  }, [ops?.queuePulse]);

  return (
    <section className="overflow-hidden rounded-[15px] border border-[#e7e7e7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
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
          <MonthFilterPill />
          <Link
            href={ROUTES.tasks}
            className="inline-flex h-[35px] items-center rounded-[40px] bg-[#eefbff] px-6 text-[12px] font-medium tracking-[-0.05em] text-[#377dff]"
          >
            Open full queue
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border-t border-[#e7e7e7] px-4 py-12 text-center text-sm text-[rgba(0,0,0,0.5)]">
          Queue is quiet. New assignments will appear here live.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#f6f6f6] text-[14px] font-medium tracking-[-0.05em] text-[#666]">
                <th className="px-5 py-2.5 first:rounded-l-[5px]">ID</th>
                <th className="px-3 py-2.5">Task</th>
                <th className="px-3 py-2.5">Place</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-5 py-2.5 last:rounded-r-[5px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isNew = newIds.has(item.id);
                const offered =
                  item.backendStatus === "OFFERED" || hasOpenRejectUi(item.id);
                const openable = canOpenTask(item);
                const label = statusBadgeLabel(item);

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-t border-[#e7e7e7] text-[13px] font-medium tracking-[-0.03em] text-[rgba(0,16,44,0.5)]",
                      isNew && "bg-[#f8fbff]",
                      openable && "cursor-pointer hover:bg-[#fafafa]",
                    )}
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
                    <td className="px-5 py-5">#{index + 1}</td>
                    <td className="max-w-[180px] truncate px-3 py-5">
                      {item.taskType?.replaceAll("_", " ") ?? item.title}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-5">
                      {placeLabel(item)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5">
                      {receivedTime(item.updatedAt)}
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
                            chipTone(item),
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
                    <td className="whitespace-nowrap px-3 py-5">
                      {receivedDate(item.updatedAt)}
                    </td>
                    <td className="px-5 py-5">
                      <Link
                        href={ROUTES.task(item.id)}
                        className="inline-flex size-4 items-center justify-center"
                        aria-label={`Open ${item.title}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {/* Figma Hide Icon 16×16 — glyph ~14.5×8.4 */}
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
  );
}
