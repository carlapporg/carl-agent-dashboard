import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "error" | "info" | "success";
};

export function Alert({
  className,
  variant = "error",
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-relaxed",
        variant === "error" && "border-red-200 bg-red-50 text-red-700",
        variant === "info" && "border-border bg-surface-hover text-foreground-soft",
        variant === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
