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
  subtitle = "Agent workspace",
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
      <div className="rounded-[var(--radius-card)] border border-border bg-surface px-6 py-7 shadow-[var(--shadow-soft)] sm:px-8 sm:py-8">
        <header className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
            Carl
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[var(--letter-nav)] text-muted-dim">
            {subtitle}
          </p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
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
