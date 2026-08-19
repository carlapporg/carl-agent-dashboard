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
          "w-full rounded-[var(--radius-md)] border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-dim outline-none",
          "h-[length:var(--control-height)] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "transition-[border-color,box-shadow,background-color]",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          hasError ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
