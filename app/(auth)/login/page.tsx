import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { env } from "@/lib/config/env";
import { ROUTES } from "@/lib/constants/routes";

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in to continue"
      subtitle="Agent workspace"
      description="Handle customer requests, follow ups, and approvals — all in one calm workspace."
      footer={
        <>
          Need help? Contact your team lead.
          <span className="mt-1 block text-xs text-muted-dim">
            New agent?{" "}
            <Link
              href={ROUTES.register}
              className="font-semibold text-accent hover:text-accent-hover"
            >
              Create an account
            </Link>
          </span>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm demoMode={!env.isApiConfigured} />
      </Suspense>
    </AuthCard>
  );
}
