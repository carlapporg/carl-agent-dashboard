"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { OfferActions } from "@/features/dashboard/components/offer-actions";
import { useOps } from "@/features/ops/ops-provider";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import { offerWindowEnd } from "@/types/agent";
import type { Task } from "@/types/task";

type LiveTaskQueueProps = {
  seedTasks: Task[];
};

function receivedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusBadgeLabel(task: Task): string {
  if (task.backendStatus === "OFFERED") return "Offered";
  if (task.backendStatus === "ASSIGNED") return "Assigned";
  if (task.backendStatus === "WAITING_FOR_USER") return "Waiting";
  if (task.backendStatus === "IN_PROGRESS") return "Active";
  if (task.backendStatus === "WAITING_FOR_AGENT") return "Waiting";
  return task.status.replaceAll("_", " ");
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
  }, [ops?.liveTasks, ops?.offer, rejectedTick, seedTasks]);

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Live task queue</h2>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700",
              (ops?.livePulse || highlight) && "dash-live-badge-pop ring-2 ring-emerald-300",
            )}
          >
            <span className="dash-live-dot size-2 rounded-full bg-emerald-500" />
            LIVE
            <span className="tabular-nums text-emerald-800">{items.length}</span>
          </span>
        </div>
        <Link
          href={ROUTES.tasks}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Open full queue
        </Link>
      </div>

      <Card
        className={cn(
          "overflow-hidden p-0 transition-shadow",
          highlight && "ring-2 ring-accent/30 shadow-[var(--shadow-soft)]",
        )}
      >
        <div className="border-b border-border bg-[#f8fafc] px-4 py-3 text-sm text-muted">
          Newest first. First offer: 30s to accept or reject. Later assignment: Start only.
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">
            Queue is quiet. New assignments will appear here live.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 p-3">
            {items.map((item, index) => {
              const isNew = newIds.has(item.id);
              const offered = item.backendStatus === "OFFERED";
              const assigned = item.backendStatus === "ASSIGNED";
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface px-4 py-3.5 transition-all hover:border-accent/30 sm:flex-row sm:items-center sm:justify-between",
                      isNew && "dash-drop-in border-accent/40",
                      index === 0 && "border-accent/20",
                    )}
                  >
                    {isNew ? (
                      <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
                    ) : null}

                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          index === 0
                            ? "bg-accent text-accent-foreground"
                            : "bg-accent/10 text-accent",
                        )}
                      >
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                            {item.taskType?.replaceAll("_", " ") ?? "Task"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                              offered
                                ? "bg-amber-50 text-amber-800"
                                : assigned
                                  ? "bg-accent/10 text-accent"
                                  : item.backendStatus === "WAITING_FOR_USER"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-emerald-50 text-emerald-800",
                            )}
                          >
                            {statusBadgeLabel(item)}
                          </span>
                          {isNew ? (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                              Just in
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">
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

                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      {offered ? (
                        <OfferCountdown
                          expiresAt={offerWindowEnd(item)}
                          taskId={item.id}
                          autoAccept
                          onExpire={() => ops?.refresh()}
                        />
                      ) : (
                        <StatusBadge status={item.status} />
                      )}
                      {offered || assigned ? <OfferActions task={item} /> : null}
                      <Link
                        href={ROUTES.task(item.id)}
                        className="inline-flex h-9 items-center rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
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
      </Card>
    </section>
  );
}
