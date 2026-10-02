import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-0 flex-1 flex-col">
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="flex min-h-full flex-col items-center justify-center py-3">
          {children}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 pb-4 text-center text-xs text-muted-dim sm:pb-5">
        Carl · Agent workspace
      </footer>
    </div>
  );
}
