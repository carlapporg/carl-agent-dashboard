import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Session expired",
};

export default function UnauthorizedPage() {
  return (
    <div className="auth-shell relative flex min-h-full flex-1 flex-col">
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-5 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-dim">
          Unauthorized
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Your session ended
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted md:text-lg">
          For security, we signed you out — or this page needs you signed in.
          Sign in again and you’ll be right back.
        </p>
        <Link
          href={ROUTES.login}
          className="inline-flex h-14 items-center justify-center rounded-xl bg-accent px-6 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Sign in again
        </Link>
      </main>
    </div>
  );
}
