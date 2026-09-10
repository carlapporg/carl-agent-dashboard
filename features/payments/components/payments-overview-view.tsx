"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { Button } from "@/components/ui/button";
import { AvailabilityToggle } from "@/features/dashboard/components/availability-toggle";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
import {
  MonthFilterPill,
  type MonthFilterValue,
} from "@/features/dashboard/components/month-filter-pill";
import {
  downloadTransactionsCsv,
  filterTransactionsByDate,
} from "@/features/payments/lib/transaction-export";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type {
  PaymentSummaryMetric,
  PaymentTransactionRow,
} from "@/lib/api/payments-overview";

type PaymentsOverviewViewProps = {
  summary: PaymentSummaryMetric[];
  transactions: PaymentTransactionRow[];
};

const METRIC_UI: Record<
  string,
  {
    label: string;
    hint: string;
    icon: string;
    variant: "plain" | "plainCyan" | "plainGreen";
  }
> = {
  revenue: {
    label: "Total Revenue",
    hint: "Offered - Accept or reject in 30 seconds.",
    icon: "/figma/payments/coin-dollar.svg",
    variant: "plainCyan",
  },
  pending: {
    label: "Pending payouts",
    hint: "13 tasks are currently being processed for customers.",
    icon: "/figma/dashboard/copy-03.svg",
    variant: "plain",
  },
  refunds: {
    label: "Refund triggered",
    hint: "Waiting for users from Nest.",
    icon: "/figma/payments/refresh-04.svg",
    variant: "plainCyan",
  },
  escrows: {
    label: "Completed escrows",
    hint: "Finished in this list.",
    icon: "/figma/payments/wallet-01.svg",
    variant: "plainGreen",
  },
};

function MetricIcon({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={26} height={26} className="size-[26px]" />
  );
}

/** Figma money: `2,500 $` */
function figmaMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} $`;
}

function formatTxnDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status: PaymentTransactionRow["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending Payment";
  return "Refunded";
}

function statusChip(status: PaymentTransactionRow["status"]) {
  if (status === "completed") {
    return "bg-[rgba(61,188,61,0.2)] text-[#3dbc3d]";
  }
  if (status === "pending") {
    return "bg-[rgba(255,94,94,0.2)] text-[#ff5e5e]";
  }
  return "bg-[rgba(84,149,253,0.2)] text-[#5072e8]";
}

function rangeForMonthFilter(value: MonthFilterValue): {
  from: string | null;
  to: string | null;
} {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = end.toISOString().slice(0, 10);
  const start = new Date(end);

  if (value === "Today") {
    // start already = today
  } else if (value === "This week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  } else if (value === "This month") {
    start.setDate(1);
  } else if (value === "All time") {
    return { from: null, to: null };
  }

  return { from: start.toISOString().slice(0, 10), to };
}

export function PaymentsOverviewView({
  summary,
  transactions,
}: PaymentsOverviewViewProps) {
  const { toast } = useToast();
  const ops = useOps();
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<MonthFilterValue>("This month");

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions, appliedFrom, appliedTo),
    [appliedFrom, appliedTo, transactions],
  );

  const filterActive = appliedFrom != null || appliedTo != null;
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

  useEffect(() => {
    if (!filterOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (filterTriggerRef.current?.contains(target)) return;
      if (filterMenuRef.current?.contains(target)) return;
      setFilterOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filterOpen]);

  function applyDateFilter() {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      toast("Start date must be before end date.", "error");
      return;
    }
    setAppliedFrom(draftFrom || null);
    setAppliedTo(draftTo || null);
    setFilterOpen(false);
  }

  function clearDateFilter() {
    setDraftFrom("");
    setDraftTo("");
    setAppliedFrom(null);
    setAppliedTo(null);
    setFilterOpen(false);
  }

  function handleMonthChange(value: MonthFilterValue) {
    setMonthFilter(value);
    const range = rangeForMonthFilter(value);
    setAppliedFrom(range.from);
    setAppliedTo(range.to);
    setDraftFrom(range.from ?? "");
    setDraftTo(range.to ?? "");
  }

  function handleExportCsv() {
    if (filteredTransactions.length === 0) {
      toast("No transactions to export for the current filter.", "error");
      return;
    }
    downloadTransactionsCsv(filteredTransactions);
    toast(
      `Exported ${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? "" : "s"}.`,
      "success",
    );
  }

  const orderedMetrics = useMemo(() => {
    const order = ["revenue", "pending", "refunds", "escrows"];
    const byId = new Map(summary.map((m) => [m.id, m]));
    return order
      .map((id) => byId.get(id))
      .filter((m): m is PaymentSummaryMetric => Boolean(m));
  }, [summary]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
            Payments Overview
          </h1>
          <p className="mt-3 text-[16px] font-normal tracking-[-0.02em] text-muted">
            Your current sales summary and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AvailabilityToggle activeTaskCount={activeTaskCount} />
          <MonthFilterPill value={monthFilter} onChange={handleMonthChange} />
        </div>
      </section>

      <div className="grid gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
        {orderedMetrics.map((metric, index) => {
          const ui = METRIC_UI[metric.id] ?? {
            label: metric.label,
            hint: metric.label,
            icon: "/figma/payments/coin-dollar.svg",
            variant: "plain" as const,
          };
          const delta = metric.deltaPercent;
          const badge =
            delta == null ? null : `${Math.abs(delta).toFixed(1)}%`;
          const badgeTrend =
            delta == null ? "up" : delta >= 0 ? "up" : "down";

          return (
            <MetricStatCard
              key={metric.id}
              label={ui.label}
              value={figmaMoney(metric.amount)}
              hint={ui.hint}
              icon={<MetricIcon src={ui.icon} />}
              variant={ui.variant}
              badge={badge}
              badgeTrend={badgeTrend}
              className="dash-slide-in"
              style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
            />
          );
        })}
      </div>

      <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
              Live Task Queue
            </h2>
            <span className="relative inline-flex items-center gap-2 rounded-[50px] bg-[rgba(61,188,61,0.2)] py-1 pl-6 pr-4 text-[12px] font-medium tracking-[-0.03em] text-[#3dbc3d]">
              <span className="absolute left-3.5 top-1/2 size-[5px] -translate-y-1/2 rounded-full bg-[#3dbc3d]" />
              {filteredTransactions.length} Live Task
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MonthFilterPill value={monthFilter} onChange={handleMonthChange} />
            <button
              ref={filterTriggerRef}
              type="button"
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
              onClick={() => setFilterOpen((open) => !open)}
              className={cn(
                "inline-flex h-[35px] items-center rounded-[40px] bg-surface-muted px-4 text-[12px] font-medium tracking-[-0.05em] text-foreground",
                filterActive && "ring-1 ring-[#377dff]/40",
              )}
            >
              Filter Date
              {filterActive ? (
                <span className="ml-1.5 size-1.5 rounded-full bg-accent" aria-hidden />
              ) : null}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-[35px] items-center rounded-[40px] bg-accent-soft px-5 text-[12px] font-medium tracking-[-0.05em] text-accent"
            >
              Export CSV
            </button>
            <Link
              href={ROUTES.tasks}
              className="inline-flex h-[35px] items-center rounded-[40px] bg-accent-soft px-6 text-[12px] font-medium tracking-[-0.05em] text-accent"
            >
              Open full queue
            </Link>

            <AnchoredMenu
              open={filterOpen}
              triggerRef={filterTriggerRef}
              menuRef={filterMenuRef}
              role="dialog"
              aria-label="Filter by date"
              className="w-72 rounded-[12px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
            >
              <p className="text-sm font-semibold text-foreground">
                Filter by date
              </p>
              <div className="mt-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted">
                    From
                  </span>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted">
                    To
                  </span>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={clearDateFilter}>
                  Clear
                </Button>
                <Button type="button" onClick={applyDateFilter}>
                  Apply
                </Button>
              </div>
            </AnchoredMenu>
          </div>
        </div>

        {filterActive ? (
          <p className="border-t border-border px-4 py-2 text-xs text-muted md:px-5">
            Showing {filteredTransactions.length} of {transactions.length}{" "}
            transactions
            {appliedFrom ? ` from ${appliedFrom}` : ""}
            {appliedTo ? ` to ${appliedTo}` : ""}
          </p>
        ) : null}

        {filteredTransactions.length === 0 ? (
          <div className="border-t border-border px-4 py-12 md:px-5">
            <EmptyState
              title={filterActive ? "No matches" : "No transactions"}
              description={
                filterActive
                  ? "Try widening the date range or clear the filter."
                  : "Payment activity across your tasks will list here."
              }
              action={
                filterActive ? (
                  <Button type="button" variant="secondary" onClick={clearDateFilter}>
                    Clear filter
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-muted">
                  <th className="px-5 py-2.5 first:rounded-l-[5px]">TRX ID</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Payment Method</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5 last:rounded-r-[5px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((row) => {
                  const href = row.taskId
                    ? ROUTES.taskPanel(row.taskId, "payment")
                    : ROUTES.payments;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-border text-[13px] font-medium tracking-[-0.03em] text-muted hover:bg-surface-hover"
                    >
                      <td className="px-5 py-5">
                        <Link
                          href={href}
                          className="font-medium text-muted hover:text-accent"
                        >
                          {row.txnId}
                        </Link>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-5">
                        {row.customer}
                      </td>
                      <td className="whitespace-nowrap px-3 py-5 tabular-nums">
                        {figmaMoney(row.amount)}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-5">
                        {row.method}
                      </td>
                      <td className="px-3 py-5">
                        <span
                          className={cn(
                            "inline-flex rounded-[50px] px-3.5 py-1 text-[12px] font-medium tracking-[-0.03em]",
                            statusChip(row.status),
                          )}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-5">
                        {formatTxnDate(row.at)}
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
