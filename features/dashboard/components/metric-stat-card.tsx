"use client";

import { cn } from "@/lib/utils/cn";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Figma metric cards (Dashboard Home 200:24736–741)
 * -------------------------------------------------
 * Card size: 260×150, radius 10, padding 15
 * Gap between cards: 25
 *
 * Relative to card origin:
 *  label  → left 15, top 15, 16px Medium, tracking -0.8px
 *  icon   → right 15, top 15, 46×46 circle, glyph 26×26
 *  value  → left 15, top 44, 42px Regular, tracking -2.1px, leading-none
 *  hint   → left 15, bottom 15, max-width 147, 12px Regular, tracking -0.6px
 *  badge  → bottom-right next to hint (Completed only)
 */
export type MetricStatCardVariant =
  | "featured"
  | "plain"
  | "plainCyan"
  | "plainGreen";

type MetricStatCardProps = {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  variant?: MetricStatCardVariant;
  badge?: string | null;
  /** Figma delta pill — green up vs red down */
  badgeTrend?: "up" | "down";
  className?: string;
  style?: CSSProperties;
};

export function MetricStatCard({
  label,
  value,
  hint,
  icon,
  variant = "plain",
  badge,
  badgeTrend = "up",
  className,
  style,
}: MetricStatCardProps) {
  const numeric = typeof value === "number";
  const [shown, setShown] = useState(numeric ? value : 0);

  useEffect(() => {
    if (!numeric) return;
    const from = shown;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 420;
    let frame = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      setShown(Math.round(from + (to - from) * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from previous shown
  }, [value]);

  const display = numeric ? String(shown).padStart(2, "0") : value;
  const featured = variant === "featured";

  return (
    <div
      className={cn(
        "relative h-[150px] w-full overflow-hidden rounded-[10px]",
        featured
          ? "bg-gradient-to-b from-[#4f7cff] to-[#85c9ff] text-white shadow-[inset_0_3px_25px_rgba(255,255,255,0.5),inset_0_-5px_15px_rgba(255,255,255,0.3)]"
          : "border border-[#e7e7e7] bg-white",
        className,
      )}
      style={style}
    >
      {/* Icon — Figma ellipse 46×46 at top-right +15 */}
      <span
        className={cn(
          "absolute right-[15px] top-[15px] flex size-[46px] items-center justify-center rounded-full",
          featured
            ? "bg-white text-[#1f1f21]"
            : variant === "plain"
              ? "bg-[#1f1f21] text-white"
              : "bg-gradient-to-b from-[#4f7cff] to-[#85c9ff] text-white shadow-[inset_0_3px_10px_rgba(255,255,255,0.45)]",
        )}
        aria-hidden
      >
        <span className="relative block size-[26px] [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_svg]:size-[26px]">
          {icon}
        </span>
      </span>

      {/* Label — 16 Medium / -0.8px */}
      <p
        className={cn(
          "absolute left-[15px] top-[15px] max-w-[calc(100%-76px)] truncate text-[16px] font-medium leading-none tracking-[-0.05em]",
          featured ? "text-white" : "text-[#1f1f21]",
        )}
      >
        {label}
      </p>

      {/* Value — 42 Regular / -2.1px / top 44 */}
      <p
        className={cn(
          "absolute left-[15px] top-[44px] text-[42px] font-normal leading-none tracking-[-0.05em] tabular-nums",
          featured ? "text-white" : "text-[#1f1f21]",
        )}
      >
        {display}
      </p>

      {/* Hint + badge — bottom 15 */}
      <div className="absolute inset-x-[15px] bottom-[15px] flex items-end justify-between gap-2">
        <p
          className={cn(
            "max-w-[147px] text-[12px] font-normal leading-[15px] tracking-[-0.05em]",
            featured ? "text-white" : "text-[rgba(31,31,33,0.56)]",
          )}
        >
          {hint}
        </p>
        {badge ? (
          <span
            className={cn(
              "inline-flex h-[14px] shrink-0 items-center gap-0.5 rounded-[30px] px-1.5 text-[8px] font-medium tracking-[-0.05em]",
              badgeTrend === "down"
                ? "bg-[rgba(255,94,94,0.15)] text-[#ff5e5e]"
                : "bg-[rgba(61,188,61,0.15)] text-[#3dbc3d]",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/dashboard/arrow-up.svg"
              alt=""
              width={10}
              height={10}
              className={cn(
                "size-2.5",
                badgeTrend === "down" ? "-rotate-90 opacity-80" : "rotate-90",
              )}
            />
            {badge.replace(/^[+\-]\s*/, "")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
