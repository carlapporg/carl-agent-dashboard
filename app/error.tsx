"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[agent-dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-dim">
        500
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        We hit an unexpected snag. Try again — if it keeps happening, tell your
        admin.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-dim">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href={ROUTES.dashboard}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
