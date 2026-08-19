"use client";

import { cn } from "@/lib/utils/cn";

type ShiftProgressProps = {
  completed: number;
  inProgress: number;
  total: number;
  className?: string;
};

function Donut({
  completed,
  inProgress,
  total,
}: {
  completed: number;
  inProgress: number;
  total: number;
}) {
  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(total, 1);
  const doneLen = (completed / safe) * circumference;
  const activeLen = (inProgress / safe) * circumference;
  const donePct = Math.round((completed / safe) * 100);

  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${doneLen} ${circumference - doneLen}`}
          strokeDashoffset={0}
          className="dash-progress-fill"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4f7cff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${activeLen} ${circumference - activeLen}`}
          strokeDashoffset={-doneLen}
          className="dash-progress-fill"
          style={{ animationDelay: "100ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {donePct}%
        </p>
        <p className="text-sm font-medium text-muted">wrapped up</p>
      </div>
    </div>
  );
}

function TasksPerHourSparkline() {
  const points = [18, 22, 20, 28, 26, 34, 40, 38, 48, 55, 52, 64];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 220;
  const h = 88;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * w;
      const y = h - ((value - min) / Math.max(max - min, 1)) * (h - 12) - 6;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="min-w-[200px] flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Tasks / hour
      </p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 h-24 w-full overflow-visible"
        role="img"
        aria-label="Tasks per hour trending up"
      >
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f7cff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4f7cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${w},${h} L0,${h} Z`}
          fill="url(#sparkFill)"
          className="dash-slide-in"
        />
        <path
          d={path}
          fill="none"
          stroke="#4f7cff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dash-slide-in"
        />
      </svg>
      <p className="mt-1 text-sm font-medium text-accent">
        Trending up this hour
      </p>
    </div>
  );
}

export function ShiftProgress({
  completed,
  inProgress,
  total,
  className,
}: ShiftProgressProps) {
  const remaining = Math.max(total - completed - inProgress, 0);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] md:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <Donut
            completed={completed}
            inProgress={inProgress}
            total={total}
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Shift progress
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {completed} done · {inProgress} in motion · {remaining} waiting
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              Updates automatically as tasks move through the queue.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Completed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-accent" />
                In progress
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#eef2f7] ring-1 ring-border" />
                Still in queue
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <TasksPerHourSparkline />
          <button
            type="button"
            className="inline-flex w-fit items-center rounded-full bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
          >
            Keep the streak going
          </button>
        </div>
      </div>
    </div>
  );
}
