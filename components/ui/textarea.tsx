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
          "w-full rounded-[var(--radius-md)] border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-dim outline-none",
          "min-h-24 duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "transition-[border-color,box-shadow]",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          hasError ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
