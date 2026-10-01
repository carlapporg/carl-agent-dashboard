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
      <main className="relative z-10 flex flex-1 overflow-y-auto px-4 py-10 sm:px-6 sm:py-16">
        <div className="m-auto flex w-full justify-center py-4">{children}</div>
      </main>

      <footer className="relative z-10 shrink-0 pb-4 text-center text-xs text-muted-dim sm:pb-5">
        Carl · Agent workspace
      </footer>
    </div>
  );
}
