import { cn } from "@/lib/utils/cn";
import { formatStatus } from "@/features/tasks/components/status-badge";
import type { CSSProperties } from "react";
import type { TaskStatus } from "@/types/task";

/** Happy-path stages used for progress UI (excludes cancelled/failed). */
export const TASK_STAGES: Array<{
  status: TaskStatus;
  label: string;
  color: string;
}> = [
  { status: "queued", label: "Offered", color: "#9ca3af" },
  { status: "assigned", label: "Assigned", color: "#60a5fa" },
  { status: "in_progress", label: "In Progress", color: "#4f7cff" },
  { status: "waiting_for_customer", label: "Waiting for Customer", color: "#f59e0b" },
  { status: "waiting_for_payment", label: "Waiting for Payment", color: "#f97316" },
  { status: "completed", label: "Completed", color: "#10b981" },
];

export function stageIndex(status: TaskStatus): number {
  const idx = TASK_STAGES.findIndex((s) => s.status === status);
  if (idx >= 0) return idx;
  if (status === "cancelled" || status === "failed") return -1;
  return 0;
}

export function stageProgressPercent(status: TaskStatus): number {
  const idx = stageIndex(status);
  if (idx < 0) return 0;
  return Math.round((idx / (TASK_STAGES.length - 1)) * 100);
}

type StageRingProps = {
  status: TaskStatus;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
};

export function StageRing({
  status,
  size = 132,
  stroke = 12,
  className,
  label,
}: StageRingProps) {
  const pct = stageProgressPercent(status);
  const idx = stageIndex(status);
  const color =
    idx >= 0
      ? TASK_STAGES[idx].color
      : status === "failed"
        ? "#dc2626"
        : "#6b7280";
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="dash-progress-fill"
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {status === "cancelled" || status === "failed" ? "—" : `${pct}%`}
        </p>
        <p className="mt-0.5 max-w-[5.5rem] text-center text-xs font-medium text-muted">
          {label ?? formatStatus(status)}
        </p>
      </div>
    </div>
  );
}

type StageLegendProps = {
  status: TaskStatus;
  className?: string;
};

export function StageLegend({ status, className }: StageLegendProps) {
  const current = stageIndex(status);

  return (
    <ol className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {TASK_STAGES.map((stage, index) => {
        const done = current > index;
        const active = current === index;
        return (
          <li
            key={stage.status}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
              active
                ? "border-transparent text-white"
                : done
                  ? "border-border bg-surface-hover text-foreground"
                  : "border-border bg-surface text-muted",
            )}
            style={active ? { backgroundColor: stage.color } : undefined}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: active || done ? stage.color : "var(--border)",
                boxShadow: active ? `0 0 0 4px ${stage.color}33` : undefined,
              }}
            />
            <span className="font-medium">{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

type MiniRingProps = {
  percent: number;
  color?: string;
  size?: number;
  className?: string;
  animate?: boolean;
};

export function MiniRing({
  percent,
  color = "var(--accent)",
  size = 44,
  className,
  animate = false,
}: MiniRingProps) {
  const stroke = Math.max(3, size * 0.09);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference -
    (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={cn("-rotate-90", className)}
      aria-hidden
      style={{ "--ring-full": String(circumference) } as CSSProperties}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={animate ? "task-ring-draw" : undefined}
      />
    </svg>
  );
}

export function MiniRingLabel({
  percent,
  color,
  size = 44,
  animate = false,
}: MiniRingProps) {
  const safe = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <MiniRing percent={safe} color={color} size={size} animate={animate} />
      <span className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums leading-none text-foreground">
        <span style={{ fontSize: Math.max(9, size * 0.26) }}>{safe}</span>
        <span
          className="ml-px text-muted"
          style={{ fontSize: Math.max(7, size * 0.18) }}
        >
          %
        </span>
      </span>
    </div>
  );
}
