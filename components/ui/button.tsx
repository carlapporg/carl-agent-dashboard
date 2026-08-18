import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  fullWidth,
  loading,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-base font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "h-[length:var(--control-height)] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        variant === "primary" &&
          "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
        variant === "secondary" &&
          "border border-border bg-surface text-foreground hover:bg-surface-hover",
        variant === "ghost" &&
          "text-muted hover:bg-surface-hover hover:text-foreground",
        variant === "danger" &&
          "bg-danger text-white hover:bg-red-700",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden
        />
      ) : null}
      <span className={cn(loading && "opacity-90")}>{children}</span>
    </button>
  );
}
