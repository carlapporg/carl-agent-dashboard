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
    <div className="auth-shell relative flex min-h-full flex-1 flex-col overflow-hidden">
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        {children}
      </main>

      <footer className="relative z-10 pb-7 text-center text-xs text-muted-dim">
        Carl · Agent Dashboard
      </footer>
    </div>
  );
}
