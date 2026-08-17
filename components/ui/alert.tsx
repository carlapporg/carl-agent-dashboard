import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "error" | "info";
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
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        variant === "error" &&
          "border-danger/30 bg-danger/10 text-danger-foreground",
        variant === "info" &&
          "border-border bg-surface-elevated text-foreground-soft",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
