import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Session expired",
};

export default function UnauthorizedPage() {
  return (
    <div className="auth-shell relative flex min-h-full flex-1 flex-col bg-background">
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-2xl font-bold tracking-tight text-foreground">Carl</p>
        <p className="text-[11px] font-semibold uppercase tracking-[var(--letter-nav)] text-muted-dim">
          Agent workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Your session ended
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted md:text-base">
          For security, we signed you out — or this page needs you signed in.
          Sign in again and you’ll be right back.
        </p>
        <Link
          href={ROUTES.login}
          className="mt-2 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Sign in again
        </Link>
      </main>
    </div>
  );
}
