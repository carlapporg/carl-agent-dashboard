import { cn } from "@/lib/utils/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, hasError, id, ...props }, ref) {
    return (
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-xl border bg-surface-elevated px-4 text-base text-foreground placeholder:text-muted-dim outline-none transition-[border-color,box-shadow,background-color]",
          "h-[length:var(--control-height)] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
          hasError ? "border-danger/70" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
