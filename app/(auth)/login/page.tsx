import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { env } from "@/lib/config/env";

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in to continue"
      subtitle="Agent Dashboard"
      description="Handle customer requests, follow ups, and approvals — all in one calm workspace."
      footer={
        <>
          Need help? Contact your team lead.
          <span className="mt-1 block text-xs text-muted-dim">
            Agents are invited by admin — no self-serve signup.
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
