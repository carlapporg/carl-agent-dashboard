import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-muted-dim" aria-hidden>
          {icon}
        </div>
      ) : (
        <div
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-hover text-muted"
          aria-hidden
        >
          <span className="text-lg">∅</span>
        </div>
      )}
      <h2 className="text-lg font-semibold text-foreground md:text-xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted md:text-base">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
