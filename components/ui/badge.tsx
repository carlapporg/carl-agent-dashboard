import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

const variants = {
  default: "bg-surface-hover text-foreground-soft border-border",
  accent: "bg-accent/15 text-accent border-accent/30",
  warning: "bg-amber-500/10 text-amber-200 border-amber-500/25",
  danger: "bg-danger/15 text-danger-foreground border-danger/30",
  success: "bg-emerald-500/10 text-emerald-200 border-emerald-500/25",
  muted: "bg-surface text-muted border-border",
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
