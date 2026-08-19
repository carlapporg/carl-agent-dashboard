import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AuthCard({
  title,
  subtitle = "Agent Dashboard",
  description,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <section
      className={cn("w-full animate-[fadeIn_300ms_ease-out]", className)}
      style={{ maxWidth: "var(--auth-card-max-width)" }}
    >
      <div
        className="border border-border bg-surface px-6 py-7 sm:px-8 sm:py-8"
        style={{
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <header className="mb-6 text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.625rem]">
            Carl
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-accent sm:text-sm">
            {subtitle}
          </p>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-snug text-muted">
              {description}
            </p>
          ) : null}
        </header>

        {children}
      </div>

      {footer ? (
        <div className="mt-4 text-center text-sm leading-snug text-muted">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
