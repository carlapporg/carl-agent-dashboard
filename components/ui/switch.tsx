"use client";

import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
};

/** Figma settings toggle — pill track, blue on / light gray off. */
export function Switch({
  checked = false,
  onCheckedChange,
  disabled,
  className,
  label,
  id,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "bg-surface-muted ring-1 ring-border",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-block size-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
