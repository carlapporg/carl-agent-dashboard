import { cn } from "@/lib/utils/cn";
import type { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-foreground-soft",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
