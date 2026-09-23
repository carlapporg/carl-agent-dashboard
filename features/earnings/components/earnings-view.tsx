"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  getEarningsLedgerAction,
  getEarningsSummaryAction,
  getEarningsTipsAction,
  getHourlyRateAction,
} from "@/features/earnings/actions";
import { ROUTES } from "@/lib/constants/routes";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";
import type {
  EarningsLedgerEntry,
  EarningsTip,
  HourlyRateRow,
} from "@/types/earnings";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMonthStart(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-01`;
}

function formatMoney(dollars: number): string {
  if (!Number.isFinite(dollars)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/** Only used when the API did not send a dollar field. */
function dollarsFromCents(cents: number): number {
  return cents / 100;
}

function rateDollars(row: HourlyRateRow): number {
  if (typeof row.hourlyRate === "number") return row.hourlyRate;
  return dollarsFromCents(row.hourlyRateCents);
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}h`;
}

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindLabel(kind: EarningsLedgerEntry["kind"]): string {
  switch (kind) {
    case "wage":
      return "Wage";
    case "tip":
      return "Tip";
    case "bonus":
      return "Bonus";
    case "adjustment":
      return "Adjustment";
    case "reimbursement":
      return "Reimbursement";
    case "penalty":
      return "Penalty";
    default:
      return kind;
  }
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function tipStatusHint(status: string): string {
  switch (status) {
    case "pending":
      return "Customer has not finished payment";
    case "captured":
      return "Counted";
    case "paid_out":
      return "Included in a paid payroll batch";
    default:
      return "";
  }
}

function Card({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <p
        className={cn(
          "font-bold tracking-[-0.02em] text-foreground",
          emphasize ? "text-base sm:text-lg" : "text-sm",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-normal leading-none tracking-tight text-foreground",
          emphasize
            ? "text-[28px] sm:text-[32px]"
            : "text-[22px] sm:text-[26px]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-3 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function EarningsView() {
  const [from, setFrom] = useState(utcMonthStart);
  const [to, setTo] = useState(utcToday);
  const rangeError = from > to ? "Start date must be on or before end date." : null;
  const range = useMemo(() => ({ from, to }), [from, to]);

  const summaryQuery = useQuery({
    queryKey: queryKeys.earnings.summary(range),
    queryFn: async () => {
      const result = await getEarningsSummaryAction(range);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: !rangeError,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const ledgerQuery = useQuery({
    queryKey: queryKeys.earnings.ledger(range),
    queryFn: async () => {
      const result = await getEarningsLedgerAction(range);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: !rangeError,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const tipsQuery = useQuery({
    queryKey: queryKeys.earnings.tips(range),
    queryFn: async () => {
      const result = await getEarningsTipsAction(range);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: !rangeError,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rateQuery = useQuery({
    queryKey: queryKeys.earnings.hourlyRate(),
    queryFn: async () => {
      const result = await getHourlyRateAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const summary = summaryQuery.data;
  const ledgerRows = (ledgerQuery.data?.entries ?? []).filter(
    (row) => row.status !== "void",
  );
  const isFetching =
    summaryQuery.isFetching ||
    ledgerQuery.isFetching ||
    tipsQuery.isFetching ||
    rateQuery.isFetching;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Earnings
          </h1>
        </div>
        <div className="flex w-fit max-w-full flex-wrap items-end gap-3">
          <label className="flex w-[9.75rem] shrink-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="box-border h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-foreground"
            />
          </label>
          <label className="flex w-[9.75rem] shrink-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="box-border h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            disabled={Boolean(rangeError) || isFetching}
            onClick={() => {
              void summaryQuery.refetch();
              void ledgerQuery.refetch();
              void tipsQuery.refetch();
              void rateQuery.refetch();
            }}
            className="inline-flex h-9 w-auto shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            {isFetching ? "…" : "Refresh"}
          </button>
        </div>
      </header>

      {rangeError ? (
        <EmptyState title="Invalid range" description={rangeError} />
      ) : null}

      {!rangeError && summaryQuery.isPending && !summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted"
            />
          ))}
        </div>
      ) : null}

      {!rangeError && summaryQuery.isError && !summary ? (
        <EmptyState
          title="Can't load earnings"
          description={
            summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : "Your login is still saved. Refresh and try again."
          }
        />
      ) : null}

      {summary ? (
        <>
          {summary.source === "ledger_plus_preview" ? (
            <p className="rounded-[var(--radius-md)] border border-warning bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
              Estimated. This month is not closed yet.
            </p>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card
              label="Pending"
              value={formatMoney(summary.payroll.pending)}
              hint="Earned, not approved yet"
              emphasize
            />
            <Card
              label="Approved"
              value={formatMoney(summary.payroll.approved)}
              hint="Reviewed, not sent yet"
              emphasize
            />
            <Card
              label="Paid"
              value={formatMoney(summary.payroll.paid)}
              hint="Marked paid"
              emphasize
            />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card
              label="Gross"
              value={formatMoney(summary.gross)}
              hint="All earned lines added together"
            />
            <Card
              label="Hours"
              value={formatHours(summary.hoursWorked)}
              hint="Available + Busy only"
            />
            <Card
              label="Hourly rate"
              value={formatMoney(summary.hourlyRate)}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Wages", value: summary.earned.wages, hint: "Hourly pay only. Tips are not included." },
              { label: "Tips", value: summary.earned.tips, hint: "Separate from wages." },
              { label: "Bonuses", value: summary.earned.bonuses, hint: "Extra pay" },
              { label: "Adjustments", value: summary.earned.adjustments, hint: "Manual corrections" },
              { label: "Reimbursements", value: summary.earned.reimbursements, hint: "Money paid back to you" },
              { label: "Penalties", value: summary.earned.penalties, hint: "Amounts taken off" },
            ].map((item) => (
              <Card
                key={item.label}
                label={item.label}
                value={formatMoney(item.value)}
                hint={item.hint}
              />
            ))}
          </section>
        </>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Hourly rate</h2>
        </div>
        {rateQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted">
            {rateQuery.error instanceof Error
              ? rateQuery.error.message
              : "Can't load the rate."}
          </p>
        ) : rateQuery.data ? (
          <div className="space-y-4 px-4 py-4">
            <p className="text-lg font-normal text-foreground">
              {formatMoney(rateDollars(rateQuery.data.current))}
            </p>
            {rateQuery.data.history.length > 0 ? (
              <ul className="divide-y divide-border border-t border-border">
                {rateQuery.data.history.map((row, index) => (
                  <li
                    key={`${row.effectiveFrom ?? "rate"}-${index}`}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatMoney(rateDollars(row))}
                      </p>
                      {row.note ? (
                        <p className="text-[12px] text-muted">{row.note}</p>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-muted">
                      {formatStamp(row.effectiveFrom)} →{" "}
                      {row.effectiveTo ? formatStamp(row.effectiveTo) : "Now"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted">Loading rate…</p>
        )}
      </section>

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Ledger</h2>
        </div>
        {ledgerQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted">
            {ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : "Can't load the ledger."}
          </p>
        ) : ledgerRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No ledger lines for this period.
          </p>
        ) : (
          <ul>
            {ledgerRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {kindLabel(row.kind)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]",
                        row.status === "paid"
                          ? "bg-success-soft text-success-foreground"
                          : row.status === "approved"
                            ? "bg-accent/10 text-accent"
                            : "bg-surface-muted text-muted",
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {row.description || "No note"}
                    {row.kind === "wage" && row.hoursWorked != null
                      ? ` · ${formatHours(row.hoursWorked)}`
                      : ""}
                    {row.kind === "wage" && row.hourlyRate != null
                      ? ` · ${formatMoney(row.hourlyRate)}/h`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatStamp(row.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-normal tabular-nums text-foreground">
                  {formatMoney(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Tips</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Customer tips. These are not added into the wage line.
          </p>
        </div>
        {tipsQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted">
            {tipsQuery.error instanceof Error
              ? tipsQuery.error.message
              : "Can't load tips."}
          </p>
        ) : !tipsQuery.data || tipsQuery.data.tips.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No tips in this period.
          </p>
        ) : (
          <ul>
            {tipsQuery.data.tips.map((tip) => (
              <TipRow key={tip.id} tip={tip} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TipRow({ tip }: { tip: EarningsTip }) {
  const hint = tipStatusHint(tip.status);
  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ROUTES.task(tip.taskId)}
            className="text-sm font-semibold text-foreground hover:text-accent"
          >
            Task tip
          </Link>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {statusLabel(tip.status)}
          </span>
        </div>
        {hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
        {tip.note ? (
          <p className="mt-1 text-sm text-foreground">{tip.note}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted">
          {formatStamp(tip.createdAt)}
          {tip.paidOutAt ? ` · Paid out ${formatStamp(tip.paidOutAt)}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-sm font-normal tabular-nums text-foreground">
        {formatMoney(tip.amount)}
      </p>
    </li>
  );
}
