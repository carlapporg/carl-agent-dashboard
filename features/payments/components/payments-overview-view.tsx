"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import {
  downloadTransactionsCsv,
  filterTransactionsByDate,
} from "@/features/payments/lib/transaction-export";
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

function money(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatTxnDate(iso: string): string {
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

function statusChip(status: PaymentTransactionRow["status"]) {
  if (status === "completed") {
    return "bg-success-soft text-success-foreground";
  }
  if (status === "pending") {
    return "bg-warning-soft text-warning-foreground";
  }
  return "bg-danger-soft text-danger-foreground";
}

function deltaChip(delta: number | null) {
  if (delta == null) return null;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        positive
          ? "bg-success-soft text-success-foreground"
          : delta > -10
            ? "bg-warning-soft text-warning-foreground"
            : "bg-danger-soft text-danger-foreground",
      )}
    >
      {positive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

export function PaymentsOverviewView({
  summary,
  transactions,
}: PaymentsOverviewViewProps) {
  const { toast } = useToast();
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions, appliedFrom, appliedTo),
    [appliedFrom, appliedTo, transactions],
  );

  const filterActive = appliedFrom != null || appliedTo != null;

  useEffect(() => {
    if (!filterOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (filterRef.current?.contains(target)) return;
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((metric) => (
          <div
            key={metric.id}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {metric.label}
            </p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {money(metric.amount, metric.currency)}
              </p>
              {deltaChip(metric.deltaPercent)}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="relative border-b border-border px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Transaction History
            </h2>
            <div ref={filterRef} className="relative flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                aria-expanded={filterOpen}
                aria-haspopup="dialog"
                onClick={() => setFilterOpen((open) => !open)}
                className={cn(filterActive && "border-accent/40 bg-accent-soft text-accent")}
              >
                Filter Date
                {filterActive ? (
                  <span className="ml-1.5 size-1.5 rounded-full bg-accent" aria-hidden />
                ) : null}
              </Button>
              <Button type="button" variant="secondary" onClick={handleExportCsv}>
                Export CSV
              </Button>

              {filterOpen ? (
                <div
                  role="dialog"
                  aria-label="Filter by date"
                  className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-dropdown)]"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Filter by date
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-muted">From</span>
                      <input
                        type="date"
                        value={draftFrom}
                        onChange={(event) => setDraftFrom(event.target.value)}
                        className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-muted">To</span>
                      <input
                        type="date"
                        value={draftTo}
                        onChange={(event) => setDraftTo(event.target.value)}
                        className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
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
                </div>
              ) : null}
            </div>
          </div>

          {filterActive ? (
            <p className="mt-2 text-xs text-muted">
              Showing {filteredTransactions.length} of {transactions.length}{" "}
              transactions
              {appliedFrom ? ` from ${appliedFrom}` : ""}
              {appliedTo ? ` to ${appliedTo}` : ""}
            </p>
          ) : null}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-6">
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
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-3 font-semibold md:px-5">Txn ID</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Payment Method</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold md:px-5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((row) => {
                  const href = row.taskId
                    ? ROUTES.taskPanel(row.taskId, "payment")
                    : ROUTES.payments;
                  return (
                    <tr key={row.id} className="hover:bg-accent-soft/30">
                      <td className="px-4 py-3.5 md:px-5">
                        <Link
                          href={href}
                          className="font-semibold text-accent hover:text-accent-hover"
                        >
                          {row.txnId}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        {row.customer}
                      </td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-foreground">
                        {money(row.amount, row.currency)}
                      </td>
                      <td className="px-4 py-3.5 text-muted">{row.method}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            statusChip(row.status),
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted md:px-5">
                        {formatTxnDate(row.at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
