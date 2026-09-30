"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/feedback/empty-state";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getEarningsLedgerAction,
  getEarningsSummaryAction,
  getHourlyRateAction,
} from "@/features/earnings/actions";
import { PayRequestPanel } from "@/features/earnings/components/pay-request-panel";
import { getTimesheetAction } from "@/features/work-diary/actions";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";
import type {
  EarningsLedgerEntry,
  EarningsSummary,
  HourlyRateRow,
} from "@/types/earnings";
import type { TimesheetInterval } from "@/types/timesheet";

type LedgerFilter = "all" | "wage" | "tip" | "bonus";

const FILTERS: { id: LedgerFilter; label: string }[] = [
  { id: "all", label: "All activity" },
  { id: "wage", label: "Hourly Wages" },
  { id: "tip", label: "Tips" },
  { id: "bonus", label: "Bonuses" },
];

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

/** Figma hero figures read “2,500 $”, not “$2,500”. */
function formatHeroMoney(dollars: number): string {
  if (!Number.isFinite(dollars)) return "—";
  const whole = Math.round(dollars);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(whole)} $`;
}

function formatSigned(dollars: number): string {
  if (!Number.isFinite(dollars)) return "—";
  const body = formatMoney(Math.abs(dollars));
  return dollars < 0 ? `-${body}` : `+${body}`;
}

function dollarsFromCents(cents: number): number {
  return cents / 100;
}

function rateDollars(row: HourlyRateRow): number {
  if (typeof row.hourlyRate === "number") return row.hourlyRate;
  return dollarsFromCents(row.hourlyRateCents);
}

function formatHours(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} hr`;
}

function formatLedgerDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function kindLabel(kind: EarningsLedgerEntry["kind"]): string {
  switch (kind) {
    case "wage":
      return "Daily Wage Shift";
    case "tip":
      return "Customer Tip";
    case "bonus":
      return "Incentive Bonus";
    case "adjustment":
      return "Wage Adjustment";
    case "reimbursement":
      return "Reimbursement";
    case "penalty":
      return "Penalty";
    default:
      return kind;
  }
}

function statusLabel(status: string): string {
  if (status === "earned") return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");
}

function ClockIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden
    >
      <circle cx="13" cy="13" r="9" stroke="white" strokeWidth="2" />
      <path
        d="M13 8.5V13l3.2 2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EarnStatCard({
  label,
  value,
  hint,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <div className="relative h-[150px] w-full rounded-[10px] bg-surface">
      <span
        className={cn(
          "absolute right-[15px] top-[15px] flex size-[46px] items-center justify-center rounded-full",
          iconClass,
        )}
      >
        {icon}
      </span>
      <p className="absolute left-[15px] top-[15px] max-w-[150px] truncate text-[16px] font-medium leading-none tracking-[-0.05em] text-[#1f1f21]">
        {label}
      </p>
      <p className="absolute left-[15px] top-[44px] text-[42px] font-normal leading-none tracking-[-0.05em] text-[#1f1f21] tabular-nums">
        {value}
      </p>
      <p className="absolute bottom-[15px] left-[15px] max-w-[147px] text-[12px] font-normal leading-[15px] tracking-[-0.05em] text-black/50">
        {hint}
      </p>
    </div>
  );
}

type DayBar = {
  key: string;
  label: string;
  wages: number;
  tips: number;
};

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const WEEKDAYS_FROM_MONDAY = 6;

/** Monday of the week that contains `date`. */
function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const back = day === 0 ? WEEKDAYS_FROM_MONDAY : day - 1;
  copy.setDate(copy.getDate() - back);
  return copy;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type ChartWeek = { id: string; label: string; from: string; to: string };

function weekLabel(start: Date, end: Date): string {
  const today = parseDay(utcToday());
  if (today >= start && today <= end) return "This week";
  const startText = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  const endText =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${startText} – ${endText}`;
}

/** Monday–Sunday weeks that touch the earnings range, newest first. */
function listChartWeeks(from: string, to: string): ChartWeek[] {
  const rangeStart = parseDay(from);
  const rangeEnd = parseDay(to);
  const weeks: ChartWeek[] = [];
  let monday = startOfWeek(rangeEnd);
  for (let index = 0; index < 8; index += 1) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    if (sunday < rangeStart) break;
    weeks.push({
      id: dateKey(monday),
      label: weekLabel(monday, sunday),
      from: dateKey(monday),
      to: dateKey(sunday),
    });
    monday = new Date(monday);
    monday.setDate(monday.getDate() - 7);
  }
  return weeks;
}

/** Hours that count as paid work on one calendar day. Online time is left out. */
function paidHoursOnDay(intervals: TimesheetInterval[], day: Date): number {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  let ms = 0;
  const now = Date.now();
  for (const interval of intervals) {
    if (interval.status !== "AVAILABLE" && interval.status !== "BUSY") continue;
    const began = new Date(interval.startedAt).getTime();
    const stopped = interval.endedAt
      ? new Date(interval.endedAt).getTime()
      : now;
    if (!Number.isFinite(began) || !Number.isFinite(stopped)) continue;
    const fromMs = Math.max(began, start.getTime());
    const toMs = Math.min(stopped, end.getTime());
    if (toMs > fromMs) ms += toMs - fromMs;
  }
  return ms / 3_600_000;
}

/**
 * Blue is wages from hours worked that day. Green is tips saved that day.
 * A weekly pay line is not dumped onto the day it was written.
 */
function buildDayBars(
  rows: EarningsLedgerEntry[],
  intervals: TimesheetInterval[],
  hourlyRate: number,
  weekFrom: string,
): DayBar[] {
  const tips = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== "tip" || row.status === "void") continue;
    const key = dayKey(row.createdAt || row.periodStart);
    if (!key) continue;
    tips.set(key, (tips.get(key) ?? 0) + row.amount);
  }

  const start = parseDay(weekFrom);
  const days: DayBar[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = dateKey(date);
    const hours = paidHoursOnDay(intervals, date);
    days.push({
      key,
      label: String(date.getDate()).padStart(2, "0"),
      wages: hours * hourlyRate,
      tips: tips.get(key) ?? 0,
    });
  }
  return days;
}

function rowRate(row: EarningsLedgerEntry, fallback: number | null): string {
  if (typeof row.hourlyRate === "number") return `${formatMoney(row.hourlyRate)}/hr`;
  if (typeof row.hourlyRateCents === "number") {
    return `${formatMoney(dollarsFromCents(row.hourlyRateCents))}/hr`;
  }
  if (row.kind === "wage" && fallback != null) return `${formatMoney(fallback)}/hr`;
  return "—";
}

type EarningsMonth = { id: string; label: string; from: string; to: string };

/** Current month, then older months, so each page of earnings can be opened. */
function listEarningsMonths(count = 12): EarningsMonth[] {
  const now = new Date();
  const today = utcToday();
  const months: EarningsMonth[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(year, month + 1, 0));
    const end = dateKey(
      new Date(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
    );
    months.push({
      id: from.slice(0, 7),
      label:
        index === 0
          ? "This month"
          : `${MONTH_SHORT[month]} ${year}`,
      from,
      to: end > today ? today : end,
    });
  }
  return months;
}

function iconForKind(kind: EarningsLedgerEntry["kind"]): {
  src: string;
  bg: string;
} {
  if (kind === "adjustment") {
    return { src: "/figma/earnings/adjust.svg", bg: "bg-[#eee5fc]" };
  }
  if (kind === "bonus" || kind === "tip") {
    return { src: "/figma/earnings/calendar.svg", bg: "bg-[#dfffdf]" };
  }
  return { src: "/figma/earnings/clock-snooze.svg", bg: "bg-[rgba(144,213,255,0.3)]" };
}

export function EarningsView() {
  const months = useMemo(() => listEarningsMonths(), []);
  const [monthId, setMonthId] = useState(months[0]?.id ?? "");
  const [monthOpen, setMonthOpen] = useState(false);
  const monthButtonRef = useRef<HTMLButtonElement>(null);
  const monthMenuRef = useRef<HTMLDivElement>(null);
  const selectedMonth = months.find((item) => item.id === monthId) ?? months[0];
  const from = selectedMonth?.from ?? utcMonthStart();
  const to = selectedMonth?.to ?? utcToday();
  const [filter, setFilter] = useState<LedgerFilter>("wage");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<EarningsLedgerEntry | null>(null);
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

  const weeks = useMemo(() => listChartWeeks(from, to), [from, to]);
  const week = weeks.find((item) => item.id === weekId) ?? weeks[0];
  const chartFrom = week?.from ?? from;
  const chartTo = week && week.to < to ? week.to : to;

  const timesheetQuery = useQuery({
    queryKey: ["earnings-chart-timesheet", chartFrom, chartTo],
    queryFn: async () => {
      const result = await getTimesheetAction({ from: chartFrom, to: chartTo });
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
  const visibleRows = ledgerRows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "wage") return row.kind === "wage" || row.kind === "adjustment";
    return row.kind === filter;
  });
  const hourly = rateQuery.data ? rateDollars(rateQuery.data.current) : null;
  const dayBars = useMemo(
    () =>
      buildDayBars(
        ledgerRows,
        timesheetQuery.data?.intervals ?? [],
        hourly ?? 0,
        chartFrom,
      ),
    [ledgerRows, timesheetQuery.data?.intervals, hourly, chartFrom],
  );
  const filterLabel =
    FILTERS.find((item) => item.id === filter)?.label ?? "Hourly Wages";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-medium leading-[1.3] tracking-[-0.05em] text-black">
            Earnings
          </h1>
          <p className="mt-0.5 max-w-[520px] text-[16px] font-normal leading-[1.3] tracking-[-0.02em] text-black/50">
            Automated payroll cycles, real-time accrued wage tracking, and instant
            pay routing.
          </p>
        </div>
        <div className="relative">
          <button
            ref={monthButtonRef}
            type="button"
            aria-expanded={monthOpen}
            aria-haspopup="menu"
            onClick={() => setMonthOpen((open) => !open)}
            className="inline-flex h-[35px] items-center gap-2.5 rounded-[40px] bg-[#f6f6f6] py-[3px] pl-5 pr-[3px] text-[12px] font-medium tracking-[-0.05em] text-foreground"
          >
            {selectedMonth?.label ?? "This month"}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/earnings/chevron-circle.svg"
              alt=""
              width={29}
              height={29}
              className={cn("size-[29px]", monthOpen && "rotate-180")}
            />
          </button>
          <AnchoredMenu
            open={monthOpen}
            triggerRef={monthButtonRef}
            menuRef={monthMenuRef}
            aria-label="Month"
            className="max-h-72 min-w-[160px] overflow-y-auto rounded-[12px] border border-border bg-surface py-1 shadow-[var(--shadow-card)]"
          >
            {months.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-[13px]",
                  item.id === selectedMonth?.id
                    ? "font-semibold text-foreground"
                    : "text-muted hover:bg-surface-muted",
                )}
                onClick={() => {
                  setMonthId(item.id);
                  setWeekId(null);
                  setActiveDay(null);
                  setMonthOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </AnchoredMenu>
        </div>
      </header>

      {rangeError ? (
        <EmptyState title="Invalid range" description={rangeError} />
      ) : null}

      {!rangeError && summaryQuery.isPending && !summary ? (
        <div className="grid grid-cols-1 gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[150px] animate-pulse rounded-[10px] bg-surface"
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
          {summary.source === "ledger_plus_preview" &&
          selectedMonth?.id === months[0]?.id ? (
            <p className="rounded-[40px] border border-warning bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
              Estimated. This month is not closed yet.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
            <EarnStatCard
              label="Gross Earnings"
              value={formatHeroMoney(summary.gross)}
              hint="Total earned this range"
              iconClass="bg-gradient-to-b from-[#4f7cff] to-[#85c9ff]"
              icon={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/figma/payments/coin-dollar.svg" alt="" width={26} height={26} />
              }
            />
            <EarnStatCard
              label="Pending"
              value={formatHeroMoney(summary.payroll.pending)}
              hint="Earned, not paid yet"
              iconClass="bg-gradient-to-b from-[#4f7cff] to-[#85c9ff]"
              icon={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/figma/payments/refresh-04.svg" alt="" width={26} height={26} />
              }
            />
            <EarnStatCard
              label="Paid"
              value={formatHeroMoney(summary.payroll.paid)}
              hint="Already marked paid"
              iconClass="bg-gradient-to-b from-[#4f7cff] to-[#85c9ff]"
              icon={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/figma/payments/wallet-01.svg" alt="" width={26} height={26} />
              }
            />
            <EarnStatCard
              label="Hourly pay"
              value={hourly == null ? "—" : formatHeroMoney(hourly)}
              hint="Per hour"
              iconClass="bg-gradient-to-b from-[#4f7cff] to-[#85c9ff]"
              icon={<ClockIcon />}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(280px,356px)]">
            <AccrualCard
              days={dayBars}
              weeks={weeks}
              weekId={week?.id ?? ""}
              onWeek={(id) => {
                setWeekId(id);
                setActiveDay(null);
              }}
              activeDay={activeDay}
              onActiveDay={setActiveDay}
            />
            <CompensationCard summary={summary} />
          </div>
        </>
      ) : null}

      <section className="overflow-hidden rounded-[15px] bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[15px] pb-3 pt-[21px] md:px-[30px]">
          <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            Earnings Ledger & Activity
          </h2>
          <div className="relative">
            <button
              ref={filterButtonRef}
              type="button"
              aria-expanded={filterOpen}
              aria-haspopup="menu"
              onClick={() => setFilterOpen((open) => !open)}
              className="inline-flex h-[35px] items-center gap-2.5 rounded-[40px] bg-[#f6f6f6] py-[3px] pl-5 pr-[3px] text-[12px] font-medium tracking-[-0.05em] text-foreground"
            >
              {filterLabel}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/figma/earnings/chevron-circle.svg"
                alt=""
                width={29}
                height={29}
                className={cn("size-[29px]", filterOpen && "rotate-180")}
              />
            </button>
            <AnchoredMenu
              open={filterOpen}
              triggerRef={filterButtonRef}
              menuRef={filterMenuRef}
              aria-label="Ledger filter"
              className="min-w-[160px] overflow-hidden rounded-[12px] border border-border bg-surface py-1 shadow-[var(--shadow-card)]"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-[13px]",
                    item.id === filter
                      ? "font-semibold text-foreground"
                      : "text-muted hover:bg-surface-muted",
                  )}
                  onClick={() => {
                    setFilter(item.id);
                    setFilterOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </AnchoredMenu>
          </div>
        </div>

        {ledgerQuery.isError ? (
          <p className="px-4 py-6 text-sm text-muted md:px-[30px]">
            {ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : "Can't load the ledger."}
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted md:px-[30px]">
            No ledger lines for this period.
          </p>
        ) : (
          <div className="overflow-x-auto px-[15px] pb-4">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-[#f6f6f6] text-[14px] font-medium tracking-[-0.05em] text-[#666]">
                  {[
                    "Description",
                    "Date",
                    "Rate",
                    "Status",
                    "Time Worked",
                    "Amount",
                    "Action",
                  ].map((label) => (
                    <th
                      key={label}
                      className="h-10 px-4 font-medium first:rounded-l-[5px] last:rounded-r-[5px]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const icon = iconForKind(row.kind);
                  const title = kindLabel(row.kind);
                  const note = row.description?.trim() || "";
                  return (
                    <tr key={row.id} className="border-b border-border">
                      <td className="border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-[5px]",
                              icon.bg,
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={icon.src} alt="" width={20} height={20} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium tracking-[-0.03em] text-foreground">
                              {title}
                            </span>
                            {note ? (
                              <span className="block truncate text-[12px] tracking-[-0.03em] text-muted">
                                {note}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-3 text-[13px] font-medium tracking-[-0.03em] text-muted">
                        {formatLedgerDate(row.createdAt || row.periodStart)}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-[13px] font-medium tracking-[-0.03em] text-muted">
                        {rowRate(row, hourly)}
                      </td>
                      <td className="border-b border-border px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-[26px] items-center rounded-[50px] px-[18px] text-[13px] font-medium tracking-[-0.03em]",
                            row.status === "paid"
                              ? "bg-[rgba(61,188,61,0.2)] text-[#3dbc3d]"
                              : "bg-[rgba(216,162,0,0.2)] text-[#d8a200]",
                          )}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="border-b border-border px-4 py-3 text-[13px] font-medium tracking-[-0.03em] text-muted">
                        {formatHours(row.hoursWorked)}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-[13px] font-semibold tracking-[-0.03em] text-foreground">
                        {formatSigned(row.amount)}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-center">
                        <button
                          type="button"
                          aria-label="View details"
                          onClick={() => setOpenRow(row)}
                          className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/figma/dashboard/eye.svg"
                            alt=""
                            width={18}
                            height={10}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PayRequestPanel />

      <Dialog
        open={openRow != null}
        onClose={() => setOpenRow(null)}
        title={openRow ? kindLabel(openRow.kind) : "Details"}
        description={openRow?.description?.trim() || undefined}
      >
        {openRow ? (
          <dl className="space-y-3 text-sm">
            <Detail label="Date" value={formatLedgerDate(openRow.createdAt || openRow.periodStart)} />
            <Detail label="Rate" value={rowRate(openRow, hourly)} />
            <Detail label="Status" value={statusLabel(openRow.status)} />
            <Detail label="Time worked" value={formatHours(openRow.hoursWorked)} />
            <Detail label="Amount" value={formatSigned(openRow.amount)} />
            {openRow.periodStart || openRow.periodEnd ? (
              <Detail
                label="Period"
                value={`${formatLedgerDate(openRow.periodStart)} – ${formatLedgerDate(openRow.periodEnd)}`}
              />
            ) : null}
          </dl>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setOpenRow(null)}>
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

const PLOT_PX = 211;

function moneyTip(amount: number): string {
  if (!Number.isFinite(amount)) return "$ 0.00";
  return `$ ${amount.toFixed(2)}`;
}

function AccrualCard({
  days,
  weeks,
  weekId,
  onWeek,
  activeDay,
  onActiveDay,
}: {
  days: DayBar[];
  weeks: ChartWeek[];
  weekId: string;
  onWeek: (id: string) => void;
  activeDay: string | null;
  onActiveDay: (key: string | null) => void;
}) {
  const [weekOpen, setWeekOpen] = useState(false);
  const weekButtonRef = useRef<HTMLButtonElement>(null);
  const weekMenuRef = useRef<HTMLDivElement>(null);
  const peak = Math.max(1, ...days.map((day) => day.wages + Math.max(0, day.tips)));
  const weekLabelText = weeks.find((item) => item.id === weekId)?.label ?? "This week";

  return (
    <section className="relative h-[348px] rounded-[15px] bg-surface px-[15px] pt-[15px]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#1f1f21]">
          Earnings Cadence & Daily Accrual
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              ref={weekButtonRef}
              type="button"
              aria-expanded={weekOpen}
              aria-haspopup="menu"
              onClick={() => setWeekOpen((open) => !open)}
              className="inline-flex h-[35px] items-center gap-2 rounded-[40px] bg-[#f6f6f6] py-[3px] pl-4 pr-[3px] text-[12px] font-medium tracking-[-0.05em] text-foreground"
            >
              {weekLabelText}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/figma/earnings/chevron-circle.svg"
                alt=""
                width={29}
                height={29}
                className={cn("size-[29px]", weekOpen && "rotate-180")}
              />
            </button>
            <AnchoredMenu
              open={weekOpen}
              triggerRef={weekButtonRef}
              menuRef={weekMenuRef}
              aria-label="Chart week"
              className="min-w-[148px] overflow-hidden rounded-[12px] border border-border bg-surface py-1 shadow-[var(--shadow-card)]"
            >
              {weeks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-[13px]",
                    item.id === weekId
                      ? "font-semibold text-foreground"
                      : "text-muted hover:bg-surface-muted",
                  )}
                  onClick={() => {
                    onWeek(item.id);
                    setWeekOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </AnchoredMenu>
          </div>
          <span className="inline-flex h-[25px] items-center gap-1.5 rounded-full bg-[#f6f6f6] px-3 text-[12px] text-[#666]">
            <span className="size-2 rounded-full bg-[#85c9ff]" />
            Wages
          </span>
          <span className="inline-flex h-[25px] items-center gap-1.5 rounded-full bg-[#f6f6f6] px-3 text-[12px] text-[#666]">
            <span className="size-2 rounded-full bg-[#90ca3a]" />
            Tips
          </span>
        </div>
      </div>

      <div className="mt-[18px]">
        <div className="flex h-[229px] items-end">
          {days.map((day) => {
            const wages = Math.max(0, day.wages);
            const tips = Math.max(0, day.tips);
            const total = wages + tips;
            const totalH = total > 0 ? (total / peak) * PLOT_PX : 0;
            const tipH = total > 0 ? (tips / total) * totalH : 0;
            const open = activeDay === day.key && total > 0;
            return (
              <button
                key={day.key}
                type="button"
                className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                onMouseEnter={() => onActiveDay(day.key)}
                onMouseLeave={() => onActiveDay(null)}
                onFocus={() => onActiveDay(day.key)}
                onBlur={() => onActiveDay(null)}
              >
                <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#efefef]" />
                {totalH > 0 ? (
                  <span
                    className="relative z-[1] flex w-[30px] flex-col overflow-visible"
                    style={{ height: totalH }}
                  >
                    {open ? (
                      <span className="absolute bottom-full left-1/2 z-20 mb-1 w-max -translate-x-1/2 rounded-[5px] border border-[#377dff]/40 bg-white px-2 py-1.5 text-left shadow-[0_0_2px_rgba(0,0,0,0.15)]">
                        <span className="block text-[10px] font-medium leading-3 text-[#1f1f21]">
                          Daily Accrual
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] leading-[10px] text-[#1f1f21]">
                          <span className="size-1 rounded-full bg-[#85c9ff]" />
                          {moneyTip(wages)} Wages
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-[10px] text-[#1f1f21]">
                          <span className="size-1 rounded-full bg-[#90ca3a]" />
                          {moneyTip(tips)} Tips
                        </span>
                      </span>
                    ) : null}
                    <span className="flex h-full w-full flex-col overflow-hidden rounded-t-[7px]">
                      {tipH > 0 ? (
                        <span
                          className="w-full shrink-0 bg-[#90ca3a]"
                          style={{ height: tipH }}
                        />
                      ) : null}
                      <span className="w-full flex-1 bg-gradient-to-b from-[#a6d6fd] to-[#f8f8f9]" />
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex">
          {days.map((day) => (
            <span
              key={day.key}
              className="flex-1 text-center text-[12px] leading-3 text-[#9a9a9a]"
            >
              {day.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompensationCard({ summary }: { summary: EarningsSummary }) {
  const parts: { label: string; amount: number; bar: string }[] = [
    {
      label: "Hourly Base Wages",
      amount: summary.earned.wages,
      bar: "bg-[#4b41e1]",
    },
    {
      label: "Incentive Bonuses",
      amount: summary.earned.bonuses,
      bar: "bg-[#84c9ff]",
    },
    {
      label: "Direct Customer Tips",
      amount: summary.earned.tips,
      bar: "bg-[#90ca3a]",
    },
  ];
  const peak = Math.max(1, ...parts.map((part) => part.amount));
  const mix = parts.reduce((sum, part) => sum + Math.max(0, part.amount), 0);

  return (
    <section className="h-[348px] rounded-[15px] bg-surface px-[15px] pt-[15px]">
      <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#1f1f21]">
        Compensation Mix
      </h2>
      <p className="mt-1 max-w-[326px] text-[12px] leading-[18px] text-black/50">
        Aggregated breakdown of earnings components
      </p>
      <ul className="mt-[28px] space-y-[22px]">
        {parts.map((part) => {
          const width = part.amount > 0 ? (part.amount / peak) * 100 : 0;
          const share =
            mix > 0 ? Math.round((Math.max(0, part.amount) / mix) * 100) : 0;
          return (
            <li key={part.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px] leading-4">
                <span className="text-[#1f1f21]">{part.label}</span>
                <span className="shrink-0 tabular-nums text-[#1f1f21]">
                  {formatMoney(part.amount)}{" "}
                  <span className="text-black/45">({share}%)</span>
                </span>
              </div>
              <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[#eff4ff]">
                <div
                  className={cn("h-full rounded-full", part.bar)}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
