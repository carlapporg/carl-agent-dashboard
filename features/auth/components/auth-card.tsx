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
        className="border border-border bg-surface px-8 py-9 sm:px-10 sm:py-10"
        style={{
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <header className="mb-8 text-center">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            Carl
          </p>
          <p className="mt-1.5 text-sm font-medium uppercase tracking-[0.14em] text-accent">
            {subtitle}
          </p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
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
        <div className="mt-6 text-center text-sm leading-relaxed text-muted">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
