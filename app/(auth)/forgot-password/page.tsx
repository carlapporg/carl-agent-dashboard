import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot password"
      subtitle="Agent workspace"
      description="Enter your email to get a reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
