import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/lib/constants/routes";

export default function LegalLayout({ children }: { children: ReactNode }) {
  // Root body is overflow-hidden (dashboard scrollport). Legal pages need their own scroll.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 md:px-6">
          <Link
            href={ROUTES.home}
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Carl
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted">
            <Link href={ROUTES.privacy} className="hover:text-foreground">
              Privacy
            </Link>
            <Link href={ROUTES.terms} className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:px-6 md:py-14">
        {children}
      </main>
      <footer className="shrink-0 border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} Carl. All rights reserved.</p>
          <p>
            Draft for product review — have counsel confirm before App Store /
            Play Store submission.
          </p>
        </div>
      </footer>
    </div>
  );
}
