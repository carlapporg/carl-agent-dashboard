import { cn } from "@/lib/utils/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-hover/80",
        className,
      )}
      aria-hidden
    />
  );
}

export function PageSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl space-y-6", className)}
      role="status"
      aria-label="Loading"
    >
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function Spinner({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "size-8 animate-spin rounded-full border-2 border-border border-t-accent",
        className,
      )}
      aria-label="Loading"
      role="status"
    />
  );
}
