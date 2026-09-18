"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  getCalendarAvailabilityAction,
  getCalendarDayAction,
  getCalendarMonthAction,
  getCalendarUpcomingAction,
  getCalendarWeekAction,
} from "@/features/calendar/actions";
import { PresenceTimeline } from "@/features/presence/components/presence-timeline";
import { ROUTES } from "@/lib/constants/routes";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";
import type {
  CalendarAvailabilitySummary,
  CalendarEvent,
  CalendarUpcomingItem,
  CalendarWeekDay,
} from "@/types/calendar";
import type { Timesheet } from "@/types/timesheet";

type Mode = "day" | "week" | "month" | "upcoming" | "availability";
type AvailMode = "day" | "range";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "upcoming", label: "Upcoming" },
  { id: "availability", label: "Availability" },
];

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  if (hours === 0 && minutes === 0) return "0h";
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
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

function formatDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

function monthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function HoursGrid({
  totalOnlineHours,
  availableHours,
  busyHours,
}: {
  totalOnlineHours: number;
  availableHours: number;
  busyHours: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        {
          label: "Total Online",
          value: totalOnlineHours,
          hint: "Available + Busy",
        },
        {
          label: "Available",
          value: availableHours,
          hint: "AVAILABLE status",
        },
        { label: "Busy", value: busyHours, hint: "BUSY status" },
      ].map((card) => (
        <div
          key={card.label}
          className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-[12px] font-medium tracking-[-0.02em] text-muted">
            {card.label}
          </p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-foreground">
            {formatHours(card.value)}
          </p>
          <p className="mt-3 text-[11px] text-muted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function LoginLogoutStrip({
  loginAt,
  logoutAt,
  isToday,
}: {
  loginAt: string | null;
  logoutAt: string | null;
  isToday: boolean;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            First login
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {loginAt ? formatStamp(loginAt) : "No login this day"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            First time you went Available or Busy.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Last logout
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {logoutAt
              ? formatStamp(logoutAt)
              : isToday
                ? "Still working"
                : "No logout this day"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Last time you went Offline. No logout means the clock never stopped.
          </p>
        </div>
      </div>
    </section>
  );
}

function AvailabilitySummaryBlock({
  availability,
  title,
}: {
  availability: CalendarAvailabilitySummary;
  title?: string;
}) {
  return (
    <div className="space-y-4">
      {title ? (
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      ) : null}
      <HoursGrid
        totalOnlineHours={availability.totalOnlineHours}
        availableHours={availability.availableHours}
        busyHours={availability.busyHours}
      />
      <PresenceTimeline intervals={availability.intervals} />
    </div>
  );
}

function TimesheetBlock({ timesheet }: { timesheet: Timesheet }) {
  const period =
    timesheet.date ??
    (timesheet.from && timesheet.to
      ? `${timesheet.from} → ${timesheet.to}`
      : "Period");

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Period
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {period}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:text-right">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Login
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatStamp(timesheet.loginAt)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Logout
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {timesheet.logoutAt
                  ? formatStamp(timesheet.logoutAt)
                  : "Still working"}
              </p>
            </div>
          </div>
        </div>
      </section>
      <HoursGrid
        totalOnlineHours={timesheet.totalOnlineHours}
        availableHours={timesheet.availableHours}
        busyHours={timesheet.busyHours}
      />
      <PresenceTimeline intervals={timesheet.intervals} />
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const titleNode = event.taskId ? (
    <Link
      href={ROUTES.task(event.taskId)}
      className="truncate text-sm font-semibold text-foreground hover:text-accent"
    >
      {event.title}
    </Link>
  ) : (
    <span className="truncate text-sm font-semibold text-foreground">
      {event.title}
    </span>
  );

  return (
    <li className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block size-2.5 shrink-0 rounded-full bg-accent"
              title={event.color}
              aria-hidden
            />
            {titleNode}
            {event.status ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
                {event.status}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {formatStamp(event.startAt)}
            {" → "}
            {event.endAt ? formatStamp(event.endAt) : "Open"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {[event.type, event.source, event.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {event.notes ? (
            <p className="mt-1 text-sm text-foreground">{event.notes}</p>
          ) : null}
        </div>
        {event.taskId ? (
          <Link
            href={ROUTES.task(event.taskId)}
            className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
          >
            Open task
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function EventsList({
  events,
  emptyLabel = "No scheduled events.",
}: {
  events: CalendarEvent[];
  emptyLabel?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Scheduled events
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Tasks assigned to you with a schedule. Read-only — no personal events.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UpcomingRow({ item }: { item: CalendarUpcomingItem }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ROUTES.task(item.taskId)}
            className="truncate text-sm font-semibold text-foreground hover:text-accent"
          >
            {item.title}
          </Link>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {item.status}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          {formatStamp(item.startAt)}
          {" → "}
          {item.endAt ? formatStamp(item.endAt) : "Open"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{item.type}</p>
      </div>
      <Link
        href={ROUTES.task(item.taskId)}
        className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
      >
        Open task
      </Link>
    </li>
  );
}

type MonthCell = {
  date: string;
  inMonth: boolean;
  events: CalendarEvent[];
};

function buildMonthCells(
  year: number,
  month: number,
  events: CalendarEvent[],
): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dow = first.getUTCDay(); // 0=Sun
  const mondayIndex = dow === 0 ? 6 : dow - 1;

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.startAt.slice(0, 10);
    const list = byDate.get(key);
    if (list) list.push(event);
    else byDate.set(key, [event]);
  }

  const cells: MonthCell[] = [];

  for (let i = 0; i < mondayIndex; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (mondayIndex - i)));
    const date = d.toISOString().slice(0, 10);
    cells.push({
      date,
      inMonth: false,
      events: byDate.get(date) ?? [],
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day))
      .toISOString()
      .slice(0, 10);
    cells.push({
      date,
      inMonth: true,
      events: byDate.get(date) ?? [],
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const next = new Date(`${last.date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const date = next.toISOString().slice(0, 10);
    cells.push({
      date,
      inMonth: false,
      events: byDate.get(date) ?? [],
    });
  }

  return cells;
}

function MonthGrid({
  year,
  month,
  events,
  today,
  onSelectDate,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const cells = useMemo(
    () => buildMonthCells(year, month, events),
    [year, month, events],
  );

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {monthLabel(year, month)}
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          UTC month grid. Click a day to open Day view.
        </p>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="px-1 py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((cell) => {
          const dayNum = Number(cell.date.slice(8, 10));
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={cn(
                "min-h-[88px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-surface-hover",
                !cell.inMonth && "bg-surface-muted/40 text-muted",
                isToday && "bg-accent/5",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold",
                  isToday
                    ? "bg-accent text-accent-foreground"
                    : cell.inMonth
                      ? "text-foreground"
                      : "text-muted",
                )}
              >
                {dayNum}
              </span>
              <ul className="mt-1 space-y-0.5">
                {cell.events.slice(0, 3).map((event) => (
                  <li
                    key={event.id}
                    className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-accent-foreground bg-accent/90"
                    title={event.title}
                  >
                    {event.title}
                  </li>
                ))}
                {cell.events.length > 3 ? (
                  <li className="px-1 text-[10px] text-muted">
                    +{cell.events.length - 3} more
                  </li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function WeekGrid({
  days,
  selectedDate,
  today,
  onSelectDate,
}: {
  days: CalendarWeekDay[];
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Week days</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Monday–Sunday UTC. Tap a day to see its bookings and presence.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day, index) => {
          const dayNum = Number(day.date.slice(8, 10));
          const isToday = day.date === today;
          const selected = day.date === selectedDate;
          const label = WEEKDAY_LABELS[index] ?? formatDayLabel(day.date);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={cn(
                "min-h-[120px] bg-surface p-2.5 text-left transition-colors hover:bg-surface-hover",
                selected && "bg-accent/10 ring-2 ring-inset ring-accent",
                isToday && !selected && "bg-accent/5",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
                  {label}
                </span>
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold",
                    selected || isToday
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground",
                  )}
                >
                  {dayNum}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Online {formatHours(day.availability.totalOnlineHours)}
              </p>
              <ul className="mt-2 space-y-0.5">
                {day.events.slice(0, 3).map((event) => (
                  <li
                    key={event.id}
                    className="truncate rounded px-1 py-0.5 text-[10px] font-medium bg-accent/90 text-accent-foreground"
                    title={event.title}
                  >
                    {event.title}
                  </li>
                ))}
                {day.events.length > 3 ? (
                  <li className="px-1 text-[10px] text-muted">
                    +{day.events.length - 3} more
                  </li>
                ) : null}
                {day.events.length === 0 ? (
                  <li className="px-1 text-[10px] text-muted">No bookings</li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted"
        />
      ))}
    </div>
  );
}

export function CalendarView() {
  const today = utcToday();
  const initialYm = utcYearMonth();

  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(today);
  const [weekSelectedDate, setWeekSelectedDate] = useState(today);
  const [year, setYear] = useState(initialYm.year);
  const [month, setMonth] = useState(initialYm.month);
  const [availMode, setAvailMode] = useState<AvailMode>("day");
  const [availDate, setAvailDate] = useState(today);
  const [availFrom, setAvailFrom] = useState(today);
  const [availTo, setAvailTo] = useState(today);

  const availQuery = useMemo(() => {
    if (availMode === "day") return { date: availDate } as const;
    return { from: availFrom, to: availTo } as const;
  }, [availMode, availDate, availFrom, availTo]);

  const rangeError =
    mode === "availability" && availMode === "range"
      ? availFrom > availTo
        ? "Start date must be on or before end date."
        : daysInclusive(availFrom, availTo) > 31
          ? "Date range can be at most 31 days."
          : null
      : null;

  const dayQuery = useQuery({
    queryKey: queryKeys.calendar.day(date),
    queryFn: async () => {
      const result = await getCalendarDayAction(date);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "day",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const weekDaySheetQuery = useQuery({
    queryKey: queryKeys.calendar.day(weekSelectedDate),
    queryFn: async () => {
      const result = await getCalendarDayAction(weekSelectedDate);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "week",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const weekQuery = useQuery({
    queryKey: queryKeys.calendar.week(date),
    queryFn: async () => {
      const result = await getCalendarWeekAction(date);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "week",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const monthQuery = useQuery({
    queryKey: queryKeys.calendar.month({ year, month }),
    queryFn: async () => {
      const result = await getCalendarMonthAction({ year, month });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "month",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const upcomingQuery = useQuery({
    queryKey: queryKeys.calendar.upcoming(20),
    queryFn: async () => {
      const result = await getCalendarUpcomingAction({ limit: 20 });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "upcoming",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const availabilityQuery = useQuery({
    queryKey: queryKeys.calendar.availability(availQuery),
    queryFn: async () => {
      const result = await getCalendarAvailabilityAction(availQuery);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: mode === "availability" && !rangeError,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (availMode !== "range") return;
    if (availFrom > availTo) setAvailTo(availFrom);
  }, [availMode, availFrom, availTo]);

  useEffect(() => {
    if (!weekQuery.data?.days.length) return;
    const dates = weekQuery.data.days.map((day) => day.date);
    if (dates.includes(weekSelectedDate)) return;
    const preferred = dates.includes(date)
      ? date
      : dates.includes(today)
        ? today
        : dates[0];
    setWeekSelectedDate(preferred);
  }, [weekQuery.data, weekSelectedDate, date, today]);

  const selectedWeekDay = useMemo(() => {
    if (!weekQuery.data?.days.length) return null;
    return (
      weekQuery.data.days.find((day) => day.date === weekSelectedDate) ??
      weekQuery.data.days[0] ??
      null
    );
  }, [weekQuery.data, weekSelectedDate]);

  const active =
    mode === "day"
      ? dayQuery
      : mode === "week"
        ? weekQuery
        : mode === "month"
          ? monthQuery
          : mode === "upcoming"
            ? upcomingQuery
            : availabilityQuery;

  const isPending = active.isPending;
  const isFetching = active.isFetching;
  const isError = active.isError;
  const error = active.error;

  function refetchActive() {
    void active.refetch();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Scheduled tasks and presence for you. Total Online = Available +
            Busy. Online and Offline do not count hours. No personal event
            create or edit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-border bg-surface p-1">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-semibold",
                  mode === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {mode === "day" || mode === "week" ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
          ) : null}

          {mode === "month" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                  Month
                </span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(Date.UTC(2026, m - 1, 1)).toLocaleDateString(
                        undefined,
                        { month: "long", timeZone: "UTC" },
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                  Year
                </span>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isInteger(next)) setYear(next);
                  }}
                  className="h-10 w-24 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                />
              </label>
            </div>
          ) : null}

          {mode === "availability" ? (
            <>
              <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setAvailMode("day")}
                  className={cn(
                    "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-semibold",
                    availMode === "day"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setAvailMode("range")}
                  className={cn(
                    "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-semibold",
                    availMode === "range"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  Range
                </button>
              </div>
              {availMode === "day" ? (
                <input
                  type="date"
                  value={availDate}
                  onChange={(e) => setAvailDate(e.target.value)}
                  className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                      From
                    </span>
                    <input
                      type="date"
                      value={availFrom}
                      onChange={(e) => setAvailFrom(e.target.value)}
                      className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                      To
                    </span>
                    <input
                      type="date"
                      value={availTo}
                      onChange={(e) => setAvailTo(e.target.value)}
                      className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                    />
                  </label>
                </div>
              )}
            </>
          ) : null}

          <button
            type="button"
            onClick={refetchActive}
            disabled={Boolean(rangeError) || isFetching}
            className="h-10 rounded-[var(--radius-md)] border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {rangeError ? (
        <EmptyState title="Invalid range" description={rangeError} />
      ) : null}

      {!rangeError && isPending && !active.data ? <LoadingCards /> : null}

      {!rangeError && isError && !active.data ? (
        <EmptyState
          title="Can't load calendar"
          description={
            error instanceof Error
              ? error.message
              : "Your login is still saved. Refresh and try again."
          }
        />
      ) : null}

      {mode === "day" && dayQuery.data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted">
            Day view · UTC · {formatDayLabel(dayQuery.data.date)}
          </p>
          <EventsList events={dayQuery.data.events} />
          <TimesheetBlock timesheet={dayQuery.data.timesheet} />
        </div>
      ) : null}

      {mode === "week" && weekQuery.data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted">
            Week · Monday–Sunday UTC · {weekQuery.data.from} →{" "}
            {weekQuery.data.to}
          </p>
          {weekQuery.data.days.length === 0 ? (
            <EmptyState
              title="No week data"
              description="No days returned for this week."
            />
          ) : (
            <>
              <WeekGrid
                days={weekQuery.data.days}
                selectedDate={selectedWeekDay?.date ?? weekSelectedDate}
                today={today}
                onSelectDate={setWeekSelectedDate}
              />
              {selectedWeekDay ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      {formatDayLabel(selectedWeekDay.date)}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(selectedWeekDay.date);
                        setMode("day");
                      }}
                      className="text-[12px] font-semibold text-accent hover:underline"
                    >
                      Open full day
                    </button>
                  </div>
                  {weekDaySheetQuery.data?.timesheet ? (
                    <LoginLogoutStrip
                      loginAt={weekDaySheetQuery.data.timesheet.loginAt}
                      logoutAt={weekDaySheetQuery.data.timesheet.logoutAt}
                      isToday={selectedWeekDay.date === today}
                    />
                  ) : null}
                  <EventsList
                    events={selectedWeekDay.events}
                    emptyLabel="No events this day."
                  />
                  <AvailabilitySummaryBlock
                    availability={selectedWeekDay.availability}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {mode === "month" && monthQuery.data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted">
            Month · UTC ·{" "}
            {monthLabel(monthQuery.data.year, monthQuery.data.month)}
          </p>
          <MonthGrid
            year={monthQuery.data.year}
            month={monthQuery.data.month}
            events={monthQuery.data.events}
            today={today}
            onSelectDate={(next) => {
              setDate(next);
              setMode("day");
            }}
          />
          <EventsList events={monthQuery.data.events} />
          <AvailabilitySummaryBlock
            title="Month presence"
            availability={monthQuery.data.availability}
          />
        </div>
      ) : null}

      {mode === "upcoming" && upcomingQuery.data ? (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Upcoming schedule
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Next scheduled tasks assigned to you.
            </p>
          </div>
          {upcomingQuery.data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No upcoming items.
            </p>
          ) : (
            <ul>
              {upcomingQuery.data.items.map((item) => (
                <UpcomingRow
                  key={`${item.taskId}-${item.startAt}`}
                  item={item}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {mode === "availability" && !rangeError && availabilityQuery.data ? (
        <TimesheetBlock timesheet={availabilityQuery.data} />
      ) : null}
    </div>
  );
}
