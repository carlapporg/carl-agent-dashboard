"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { useToast } from "@/components/providers/toast-provider";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskPriority, TaskStatus } from "@/types/task";

type LiveItem = {
  id: string;
  number: number;
  title: string;
  customerName: string;
  priority: TaskPriority;
  status: TaskStatus;
  isNew?: boolean;
  isSimulated?: boolean;
};

const DEMO_ARRIVALS: Array<
  Omit<LiveItem, "id" | "number" | "isNew" | "isSimulated">
> = [
  {
    title: "Airport lounge access",
    customerName: "Priya Nair",
    priority: "high",
    status: "queued",
  },
  {
    title: "Same-day florist delivery",
    customerName: "Marcus Webb",
    priority: "urgent",
    status: "queued",
  },
  {
    title: "Weekend car service",
    customerName: "Elena Rossi",
    priority: "normal",
    status: "queued",
  },
  {
    title: "Last-minute table for four",
    customerName: "Noah Park",
    priority: "high",
    status: "queued",
  },
];

type LiveTaskQueueProps = {
  seedTasks: Task[];
};

export function LiveTaskQueue({ seedTasks }: LiveTaskQueueProps) {
  const { toast } = useToast();
  const seedItems = useMemo<LiveItem[]>(
    () =>
      seedTasks
        .filter((t) => !t.parentId)
        .filter(
          (t) =>
            t.status === "queued" ||
            t.status === "in_progress" ||
            t.status === "waiting_for_payment" ||
            t.status === "waiting_for_customer" ||
            t.priority === "urgent",
        )
        .slice(0, 6)
        .map((t) => ({
          id: t.id,
          number: t.number,
          title: t.title,
          customerName: t.customerName,
          priority: t.priority,
          status: t.status,
        })),
    [seedTasks],
  );

  const [items, setItems] = useState<LiveItem[]>(seedItems);
  const [livePop, setLivePop] = useState(false);

  useEffect(() => {
    setItems(seedItems);
  }, [seedItems]);

  useEffect(() => {
    const id = window.setInterval(() => {
      let incomingId: string | null = null;
      let incomingTitle = "";
      let incomingCustomer = "";

      setItems((current) => {
        const prev = current.filter((i) => i.isSimulated).length;
        const demo = DEMO_ARRIVALS[prev % DEMO_ARRIVALS.length];
        const incoming: LiveItem = {
          ...demo,
          id: `live_${Date.now()}`,
          number: 4900 + (prev % 90),
          isNew: true,
          isSimulated: true,
        };

        incomingId = incoming.id;
        incomingTitle = incoming.title;
        incomingCustomer = incoming.customerName;

        const cleared = current.map((item) => ({ ...item, isNew: false }));
        return [incoming, ...cleared].slice(0, 6);
      });

      if (!incomingId) return;

      setLivePop(true);
      toast(`${incomingTitle} · ${incomingCustomer}`, "info", {
        placement: "top",
        title: "New task in queue",
      });

      window.setTimeout(() => setLivePop(false), 900);

      window.setTimeout(() => {
        const idToClear = incomingId;
        setItems((latest) =>
          latest.map((item) =>
            item.id === idToClear ? { ...item, isNew: false } : item,
          ),
        );
      }, 1800);
    }, 8000);

    return () => window.clearInterval(id);
  }, [toast]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            Live task queue
          </h2>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700",
              livePop && "dash-live-badge-pop ring-2 ring-emerald-300",
            )}
          >
            <span className="dash-live-dot size-2 rounded-full bg-emerald-500" />
            LIVE
          </span>
        </div>
        <Link
          href={ROUTES.tasks}
          className="text-base font-semibold text-accent hover:text-accent-hover"
        >
          Open full queue
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-[#f8fafc] px-5 py-3 text-sm text-muted md:px-6">
          Fresh asks land at the top. Demo stream updates every few seconds.
        </div>

        {items.length === 0 ? (
          <p className="px-6 py-10 text-center text-base text-muted">
            Queue is quiet. New work will slide in live.
          </p>
        ) : (
          <ul className="flex flex-col gap-0 p-3 md:p-4">
            {items.map((item, index) => {
              const href = item.isSimulated
                ? ROUTES.tasks
                : ROUTES.task(item.id);

              return (
                <li key={item.id} className="mb-2 last:mb-0">
                  <Link
                    href={href}
                    className={cn(
                      "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface px-4 py-4 transition-all hover:border-accent/30 hover:bg-accent/[0.03] sm:flex-row sm:items-center sm:justify-between md:px-5",
                      item.isNew && "dash-drop-in border-accent/40 shadow-sm",
                      index === 0 && !item.isNew && "border-accent/20",
                    )}
                  >
                    {item.isNew ? (
                      <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
                    ) : null}

                    <div className="flex min-w-0 items-center gap-3.5">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          index === 0
                            ? "bg-accent text-accent-foreground"
                            : "bg-accent/10 text-accent",
                          item.isNew && "dash-live-badge-pop",
                        )}
                      >
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.isNew ? (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent">
                              Just in
                            </span>
                          ) : null}
                          <p className="truncate text-base font-semibold text-foreground md:text-lg">
                            {item.title}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted md:text-base">
                          {item.customerName}
                          <span className="text-muted-dim">
                            {" "}
                            · #{item.number}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                      <span className="inline-flex h-8 items-center rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        {item.isSimulated ? "Preview" : "Open"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
