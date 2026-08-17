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
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface/40 px-8 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-5 text-muted-dim" aria-hidden>
          {icon}
        </div>
      ) : (
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-full bg-surface-elevated text-muted"
          aria-hidden
        >
          <span className="text-xl">∅</span>
        </div>
      )}
      <h2 className="text-xl font-medium text-foreground md:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-lg text-base leading-relaxed text-muted md:text-lg">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}
