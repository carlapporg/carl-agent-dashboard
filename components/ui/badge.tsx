import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

const variants = {
  default: "bg-surface-hover text-foreground-soft border-border",
  accent: "bg-accent/10 text-accent border-accent/25",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  muted: "bg-surface-hover text-muted border-border",
  info: "bg-blue-50 text-blue-700 border-blue-200",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold capitalize",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
