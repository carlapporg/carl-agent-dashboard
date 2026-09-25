"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/feedback/empty-state";
import { MetricStatCard } from "@/features/dashboard/components/metric-stat-card";
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

/** Compact money for metric cards (keeps type hierarchy readable). */
function formatMoneyShort(dollars: number): string {
  if (!Number.isFinite(dollars)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

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

function MetricIcon({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={26} height={26} className="size-[26px]" />
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.04em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[12px] text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
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

  const hourlyRate = rateQuery.data
    ? formatMoney(rateDollars(rateQuery.data.current))
    : "—";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-foreground">
            Earnings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Payroll status, pay breakdown, and tips for the selected range.
          </p>
        </div>
        <div className="flex w-fit max-w-full flex-wrap items-end gap-2 rounded-[40px] border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)] sm:gap-3 sm:px-4">
          <label className="flex w-[9.5rem] shrink-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-dim">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="box-border h-8 w-full border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none"
            />
          </label>
          <span className="mb-1.5 hidden h-6 w-px bg-border sm:block" aria-hidden />
          <label className="flex w-[9.5rem] shrink-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-dim">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="box-border h-8 w-full border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none"
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
            className="inline-flex h-[35px] shrink-0 items-center gap-1.5 rounded-[40px] bg-accent-soft px-4 text-[12px] font-medium tracking-[-0.05em] text-accent hover:bg-accent/15 disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/payments/refresh-04.svg"
              alt=""
              width={14}
              height={14}
              className={cn("size-3.5", isFetching && "animate-spin")}
            />
            {isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {rangeError ? (
        <EmptyState title="Invalid range" description={rangeError} />
      ) : null}

      {!rangeError && summaryQuery.isPending && !summary ? (
        <div className="grid gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[150px] animate-pulse rounded-[10px] border border-border bg-surface-muted"
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
            <p className="rounded-[40px] border border-warning bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
              Estimated. This month is not closed yet.
            </p>
          ) : null}

          {/* Hero metrics — match Payments overview cards */}
          <div className="grid gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
            <MetricStatCard
              label="Gross"
              value={formatMoneyShort(summary.gross)}
              hint="Total earned this range"
              icon={<MetricIcon src="/figma/payments/coin-dollar.svg" />}
              variant="featured"
              className="dash-slide-in"
              style={{ animationDelay: "0ms" } as CSSProperties}
            />
            <MetricStatCard
              label="Pending"
              value={formatMoneyShort(summary.payroll.pending)}
              hint="Earned, not approved yet"
              icon={<MetricIcon src="/figma/payments/refresh-04.svg" />}
              variant="plain"
              className="dash-slide-in"
              style={{ animationDelay: "60ms" } as CSSProperties}
            />
            <MetricStatCard
              label="Approved"
              value={formatMoneyShort(summary.payroll.approved)}
              hint="Approved, waiting payout"
              icon={<MetricIcon src="/figma/dashboard/check-square-02.svg" />}
              variant="plainCyan"
              className="dash-slide-in"
              style={{ animationDelay: "120ms" } as CSSProperties}
            />
            <MetricStatCard
              label="Paid"
              value={formatMoneyShort(summary.payroll.paid)}
              hint="Already marked paid"
              icon={<MetricIcon src="/figma/payments/wallet-01.svg" />}
              variant="plainGreen"
              className="dash-slide-in"
              style={{ animationDelay: "180ms" } as CSSProperties}
            />
          </div>

          {/* Breakdown strip */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: "Wages",
                value: formatMoney(summary.earned.wages),
                hint: "Hourly pay",
              },
              {
                label: "Tips",
                value: formatMoney(summary.earned.tips),
                hint: "Customer tips",
              },
              {
                label: "Bonuses",
                value: formatMoney(summary.earned.bonuses),
                hint: "Extra pay",
              },
              {
                label: "Hours",
                value: formatHours(summary.hoursWorked),
                hint: "Available + Busy",
              },
              {
                label: "Rate",
                value: rateQuery.isPending ? "…" : `${hourlyRate}/hr`,
                hint: "Current hourly",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]"
              >
                <p className="text-[12px] font-medium tracking-[-0.03em] text-muted">
                  {item.label}
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-dim">{item.hint}</p>
              </div>
            ))}
          </div>

          {rateQuery.data && rateQuery.data.history.length > 0 ? (
            <SectionCard
              title="Hourly rate history"
              description="Past rates that applied in your account."
            >
              <ul className="divide-y divide-border">
                {rateQuery.data.history.map((row, index) => (
                  <li
                    key={`${row.effectiveFrom ?? "rate"}-${index}`}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5"
                  >
                    <div>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatMoney(rateDollars(row))}
                        <span className="ml-1 text-xs font-medium text-muted">
                          /hr
                        </span>
                      </p>
                      {row.note ? (
                        <p className="mt-0.5 text-[12px] text-muted">{row.note}</p>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-muted">
                      {formatStamp(row.effectiveFrom)} →{" "}
                      {row.effectiveTo ? formatStamp(row.effectiveTo) : "Now"}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <SectionCard
        title="Ledger"
        description="Wage, tip, and bonus lines for this range."
      >
        {ledgerQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted md:px-5">
            {ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : "Can't load the ledger."}
          </p>
        ) : ledgerRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted md:px-5">
            No ledger lines for this period.
          </p>
        ) : (
          <ul>
            {ledgerRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 border-b border-border px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between md:px-5"
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
                  <p className="mt-0.5 text-[11px] text-muted-dim">
                    {formatStamp(row.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Tips"
        description="Customer tips. Not included in the wage line."
      >
        {tipsQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted md:px-5">
            {tipsQuery.error instanceof Error
              ? tipsQuery.error.message
              : "Can't load tips."}
          </p>
        ) : !tipsQuery.data || tipsQuery.data.tips.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted md:px-5">
            No tips in this period.
          </p>
        ) : (
          <ul>
            {tipsQuery.data.tips.map((tip) => (
              <TipRow key={tip.id} tip={tip} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function TipRow({ tip }: { tip: EarningsTip }) {
  const hint = tipStatusHint(tip.status);
  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between md:px-5">
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
        <p className="mt-0.5 text-[11px] text-muted-dim">
          {formatStamp(tip.createdAt)}
          {tip.paidOutAt ? ` · Paid out ${formatStamp(tip.paidOutAt)}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatMoney(tip.amount)}
      </p>
    </li>
  );
}
