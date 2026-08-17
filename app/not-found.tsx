import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-dim">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        This page isn’t here
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        The link may be old, or the page moved. Nothing to worry about — we can
        get you back.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.dashboard}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Go to dashboard
        </Link>
        <Link
          href={ROUTES.login}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
