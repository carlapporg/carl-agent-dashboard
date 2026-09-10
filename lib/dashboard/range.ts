import type { MonthFilterValue } from "@/features/dashboard/components/month-filter-pill";

/** API `range` query for dashboard overview / tasks-per-hour. */
export type DashboardRange =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year";

const LABEL_TO_RANGE: Record<MonthFilterValue, DashboardRange> = {
  Today: "today",
  "This week": "this_week",
  "This month": "this_month",
  /** Closest overview range — live queue uses true “all” (no date cut). */
  "All time": "this_year",
};

export function toDashboardRange(label: MonthFilterValue): DashboardRange {
  return LABEL_TO_RANGE[label] ?? "this_month";
}

export function formatDeltaPercent(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${text}%`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** Inclusive local-time bounds for dashboard range filters. */
export function getDashboardRangeBounds(
  range: DashboardRange,
  now = new Date(),
): { from: Date; to: Date } {
  const to = endOfLocalDay(now);

  switch (range) {
    case "today":
      return { from: startOfLocalDay(now), to };
    case "this_week": {
      const day = now.getDay(); // 0 = Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      return { from: startOfLocalDay(monday), to };
    }
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to: endOfLocalDay(lastDay) };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), quarterStartMonth, 1),
        to,
      };
    }
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to };
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
}

/** True when ISO timestamp falls inside the selected dashboard range. */
export function isTimestampInDashboardRange(
  iso: string | null | undefined,
  range: DashboardRange,
  now = new Date(),
): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  const { from, to } = getDashboardRangeBounds(range, now);
  return time >= from.getTime() && time <= to.getTime();
}
