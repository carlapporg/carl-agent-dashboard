import { cn } from "@/lib/utils/cn";
import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, hasError, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-xl border bg-surface-elevated px-4 py-3 text-base text-foreground placeholder:text-muted-dim outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
          hasError ? "border-danger/70" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
