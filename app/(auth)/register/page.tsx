import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function RegisterPage() {
  return (
    <AuthCard title="Create your account" subtitle="Agent workspace">
      <Suspense fallback={null}>
        <RegisterForm demoMode={!env.isApiConfigured} />
      </Suspense>
    </AuthCard>
  );
}
