import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

const variants = {
  default: "bg-surface-hover text-foreground-soft border-border",
  accent: "bg-accent/10 text-accent border-accent/25",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  success: "bg-success-soft text-success-foreground border-success/30",
  muted: "bg-surface-hover text-muted border-border",
  info: "bg-accent-soft text-info-foreground border-accent/25",
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
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold capitalize",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
