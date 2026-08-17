import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { env } from "@/lib/config/env";

export default function LoginPage() {
  return (
    <AuthCard
      title="Let's get to work."
      footer={
        <>
          Need help? Contact your team lead.
          <span className="mt-1 block text-xs text-muted-dim/80">
            Agents are invited by admin — no self-serve signup.
          </span>
        </>
      }
    >
      <LoginForm demoMode={env.authStubMode} />
    </AuthCard>
  );
}
