import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AuthCardProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AuthCard({ title, children, footer, className }: AuthCardProps) {
  return (
    <section
      className={cn("w-full animate-[fadeIn_350ms_ease-out]", className)}
      style={{ maxWidth: "var(--auth-card-max-width)" }}
    >
      <div
        className="border border-border/90 bg-surface/95 p-8 backdrop-blur-sm sm:p-9"
        style={{
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <header className="mb-8 text-center">
          <p className="text-[1.75rem] font-semibold tracking-tight text-foreground">
            Carl
          </p>
          <h1 className="mt-3 text-lg font-medium tracking-tight text-foreground-soft">
            {title}
          </h1>
        </header>

        {children}
      </div>

      {footer ? (
        <div className="mt-6 text-center text-sm leading-relaxed text-muted-dim">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
