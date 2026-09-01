"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { OfferActions } from "@/features/dashboard/components/offer-actions";
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

function receivedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusBadgeLabel(task: Task): string {
  if (isRejectingOrRejected(task.id) || isPendingReject(task.id)) return "Rejecting";
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
  if (
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment" ||
    task.backendStatus === "OFFERED" ||
    task.backendStatus === "WAITING_FOR_USER"
  ) {
    return "bg-warning-soft text-warning-foreground";
  }
  if (task.status === "completed") return "bg-success-soft text-success-foreground";
  if (task.status === "in_progress" || task.backendStatus === "IN_PROGRESS") {
    return "bg-accent-soft text-accent";
  }
  return "bg-surface-hover text-muted";
}

export function LiveTaskQueue({ seedTasks }: LiveTaskQueueProps) {
  const ops = useOps();
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
    const added = items.filter((t) => !prevIds.current.has(t.id)).map((t) => t.id);
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
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-semibold text-foreground">Live Task Queue</h2>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-success-foreground",
              (ops?.livePulse || highlight) && "dash-live-badge-pop",
            )}
          >
            <span className="dash-live-dot size-1.5 rounded-full bg-success" />
            Live {items.length}
          </span>
        </div>
        <Link
          href={ROUTES.tasks}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Open full queue
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-muted shadow-[var(--shadow-card)]">
          Queue is quiet. New assignments will appear here live.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isNew = newIds.has(item.id);
            const offered =
              item.backendStatus === "OFFERED" || hasOpenRejectUi(item.id);
            const assigned = item.backendStatus === "ASSIGNED";
            const waiting =
              item.status === "waiting_for_customer" ||
              item.status === "waiting_for_payment" ||
              item.backendStatus === "WAITING_FOR_USER";
            const waitingLabel = statusBadgeLabel(item);

            return (
              <li key={item.id}>
                <div
                  className={cn(
                    "flex min-h-[88px] flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4 shadow-[var(--shadow-card)] transition-shadow sm:flex-row sm:items-center sm:justify-between md:px-5",
                    isNew && "dash-drop-in ring-2 ring-accent/25",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                          {item.taskType?.replaceAll("_", " ") ?? "Task"}
                        </span>
                        {waiting || offered ? (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                            Waiting
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[15px] font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {item.customerName}
                        <span className="text-muted-dim">
                          {" "}
                          · {receivedLabel(item.updatedAt)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
                    {offered ? (
                      <OfferCountdown
                        expiresAt={offerWindowEnd(item)}
                        taskId={item.id}
                        autoAccept
                      />
                    ) : waiting ? (
                      <span className="text-sm font-medium text-muted">
                        {waitingLabel}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          chipTone(item),
                        )}
                      >
                        {waitingLabel}
                      </span>
                    )}
                    {offered || assigned ? <OfferActions task={item} /> : null}
                    <Link
                      href={ROUTES.task(item.id)}
                      className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-accent bg-surface px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
