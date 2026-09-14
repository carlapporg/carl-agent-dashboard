import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-hover",
        className,
      )}
      style={style}
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

/** Tasks page loading placeholder — pulse only, no row shimmer sweep. */
export function TasksSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("w-full space-y-6", className)}
      role="status"
      aria-label="Loading tasks"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-[34px] w-52 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-[35px] w-40 rounded-[40px]" />
      </div>

      <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[15px] py-5">
          <Skeleton className="h-7 w-44 rounded-md" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-[35px] w-28 rounded-[40px]" />
            <Skeleton className="h-[35px] w-28 rounded-[40px]" />
          </div>
        </div>

        <div className="border-t border-border px-[15px] pb-4">
          <div className="flex gap-3 bg-surface-muted px-5 py-2.5">
            <Skeleton className="h-4 w-10 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="ml-auto h-4 w-16 rounded-md" />
          </div>
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-t border-border px-5 py-5"
            >
              <Skeleton className="h-3.5 w-8 shrink-0 rounded-md" />
              <Skeleton className="h-3.5 w-[min(100%,160px)] rounded-md" />
              <Skeleton className="hidden h-3.5 w-28 shrink-0 rounded-md sm:block" />
              <Skeleton className="hidden h-3.5 w-20 shrink-0 rounded-md md:block" />
              <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
              <Skeleton className="ml-auto h-3.5 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Dashboard overview loading — high-contrast loader cards (not faint pulses). */
export function DashboardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("w-full space-y-5", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="h-[34px] w-56 animate-pulse rounded-lg bg-[#e5e7eb]" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-[#e5e7eb]" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="h-[35px] w-40 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
          <div className="h-[35px] w-28 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
        </div>
      </div>

      <div className="grid gap-[25px] sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "relative h-[150px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white p-[15px] shadow-sm",
              index === 0 && "border-transparent bg-gradient-to-b from-[#4f7cff]/40 to-[#85c9ff]/40",
            )}
          >
            <div className="flex items-start justify-between">
              <div className="h-4 w-28 animate-pulse rounded bg-[#d1d5db]" />
              <div className="size-[46px] animate-pulse rounded-full bg-[#d1d5db]" />
            </div>
            <div className="mt-4 h-10 w-16 animate-pulse rounded-md bg-[#d1d5db]" />
            <div className="absolute bottom-[15px] left-[15px] h-3 w-[140px] animate-pulse rounded bg-[#e5e7eb]" />
          </div>
        ))}
      </div>

      <div className="grid gap-[25px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-h-[424px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-6 w-40 animate-pulse rounded-md bg-[#d1d5db]" />
              <div className="h-3 w-56 animate-pulse rounded bg-[#e5e7eb]" />
            </div>
            <div className="h-[35px] w-24 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
          </div>
          <div className="mt-10 flex h-[280px] items-end gap-3 px-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className="w-full animate-pulse rounded-[10px] bg-[#e5e7eb]"
                  style={{ height: `${40 + ((i * 37) % 60)}%` }}
                />
                <div className="h-3 w-8 animate-pulse rounded bg-[#e5e7eb]" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[424px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="h-6 w-36 animate-pulse rounded-md bg-[#d1d5db]" />
            <div className="h-[35px] w-24 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
          </div>
          <div className="mt-6 h-5 w-28 animate-pulse rounded bg-[#e5e7eb]" />
          <div className="mx-auto mt-10 size-[213px] animate-pulse rounded-full border-[18px] border-[#e5e7eb] bg-transparent" />
          <div className="mt-10 flex justify-center gap-6">
            <div className="h-3 w-24 animate-pulse rounded bg-[#e5e7eb]" />
            <div className="h-3 w-28 animate-pulse rounded bg-[#e5e7eb]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[#e5e7eb]" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[15px] border border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
          <div className="h-7 w-44 animate-pulse rounded-md bg-[#d1d5db]" />
          <div className="flex flex-wrap gap-3">
            <div className="h-[35px] w-28 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
            <div className="h-[35px] w-32 animate-pulse rounded-[40px] bg-[#e5e7eb]" />
          </div>
        </div>
        <div className="border-t border-[#e5e7eb]">
          <div className="flex gap-3 bg-[#f3f4f6] px-5 py-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-4 w-16 animate-pulse rounded-md bg-[#d1d5db]"
              />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-t border-[#e5e7eb] px-5 py-5"
            >
              <div className="h-3.5 w-8 shrink-0 animate-pulse rounded-md bg-[#e5e7eb]" />
              <div className="h-3.5 w-40 animate-pulse rounded-md bg-[#e5e7eb]" />
              <div className="hidden h-3.5 w-28 shrink-0 animate-pulse rounded-md bg-[#e5e7eb] sm:block" />
              <div className="h-7 w-28 shrink-0 animate-pulse rounded-full bg-[#e5e7eb]" />
              <div className="ml-auto h-3.5 w-24 shrink-0 animate-pulse rounded-md bg-[#e5e7eb]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** History page loading placeholder — matches title + tabbed table chrome. */
export function HistorySkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("w-full space-y-5", className)}
      role="status"
      aria-label="Loading history"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-[34px] w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      <section className="overflow-hidden rounded-[15px] border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-5">
          <Skeleton className="h-7 w-40 rounded-md" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-[35px] w-32 rounded-[40px]" />
            <Skeleton className="h-[35px] w-28 rounded-[40px]" />
            <Skeleton className="h-[35px] w-32 rounded-[40px]" />
          </div>
        </div>

        <div className="border-t border-border">
          <div className="flex gap-3 bg-surface-muted px-5 py-2.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="ml-auto h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="task-row-shimmer flex items-start gap-[15px] border-t border-border px-5 py-5"
              style={{ "--row-i": index } as CSSProperties}
            >
              <Skeleton className="mt-1 size-4 shrink-0 rounded" />
              <Skeleton className="size-[50px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 pt-1.5">
                <Skeleton className="h-3.5 w-[min(100%,220px)] rounded-md" />
                <Skeleton className="h-3 w-[min(100%,360px)] rounded-md" />
              </div>
              <Skeleton className="mt-2 hidden h-3 w-24 shrink-0 rounded-md sm:block" />
              <Skeleton className="mt-2 hidden h-3 w-20 shrink-0 rounded-md md:block" />
              <Skeleton className="mt-2 h-3 w-28 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Profile page loading — avatar card + personal info card. */
export function ProfileSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("flex w-full flex-col gap-5", className)}
      role="status"
      aria-label="Loading profile"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-[34px] w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-[35px] w-28 rounded-[40px]" />
      </div>

      <div className="grid min-h-0 flex-1 gap-[25px] lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside
          className="dash-card-shimmer flex flex-col items-center rounded-[10px] border border-border bg-surface px-5 py-6"
          style={{ "--row-i": 0 } as CSSProperties}
        >
          <Skeleton className="size-[130px] rounded-full" />
          <Skeleton className="mt-[15px] h-4 w-32 rounded-md" />
          <Skeleton className="mt-2 h-3 w-16 rounded-md" />
          <Skeleton className="mt-5 h-[35px] w-36 rounded-[40px]" />
        </aside>

        <section
          className="dash-card-shimmer rounded-[10px] border border-border bg-surface px-5 py-5"
          style={{ "--row-i": 1 } as CSSProperties}
        >
          <Skeleton className="h-[34px] w-48 rounded-lg" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full rounded-md" />
          <div className="mt-12 space-y-[35px]">
            <div className="space-y-[10px]">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-[45px] w-full rounded-[5px]" />
            </div>
            <div className="max-w-md space-y-[10px]">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-[45px] w-full rounded-[5px]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Chat Box loading — conversation list + thread panel. */
export function MessagesSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] w-full flex-col gap-5 overflow-hidden",
        className,
      )}
      role="status"
      aria-label="Loading chats"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-[34px] w-40 rounded-lg" />
          <Skeleton className="h-4 w-56 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-[35px] w-40 rounded-[40px]" />
      </div>

      <div className="grid min-h-0 flex-1 gap-[25px] overflow-hidden lg:grid-cols-[minmax(292px,320px)_minmax(0,1fr)]">
        <aside
          className="dash-card-shimmer flex min-h-0 flex-col overflow-hidden rounded-[15px] border border-border bg-surface"
          style={{ "--row-i": 0 } as CSSProperties}
        >
          <div className="shrink-0 px-5 pt-5">
            <Skeleton className="h-10 w-full rounded-[8px]" />
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-hidden px-0 pb-3 pt-2">
            {Array.from({ length: 8 }, (_, index) => (
              <li
                key={index}
                className="task-row-shimmer flex items-start gap-2.5 px-5 py-[10px]"
                style={{ "--row-i": index } as CSSProperties}
              >
                <Skeleton className="size-[42px] shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <div className="flex justify-between gap-2">
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                    <Skeleton className="h-2.5 w-10 rounded-md" />
                  </div>
                  <Skeleton className="h-3.5 w-[80%] rounded-md" />
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div
          className="dash-card-shimmer flex min-h-0 flex-col overflow-hidden rounded-[15px] border border-border bg-surface"
          style={{ "--row-i": 1 } as CSSProperties}
        >
          <header className="flex shrink-0 items-center gap-2.5 px-5 py-5">
            <Skeleton className="size-[34px] rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
          </header>
          <div className="h-px w-full bg-border" />
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-5 py-5">
            <Skeleton className="ml-auto h-10 w-[55%] rounded-2xl" />
            <Skeleton className="h-10 w-[45%] rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-[40%] rounded-2xl" />
          </div>
          <div className="flex shrink-0 items-center gap-4 border-t border-border px-6 py-6">
            <Skeleton className="h-12 min-w-0 flex-1 rounded-full" />
            <Skeleton className="size-11 shrink-0 rounded-[22px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
