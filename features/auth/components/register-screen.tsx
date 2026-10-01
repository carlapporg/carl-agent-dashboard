"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { VerificationSent } from "@/features/auth/components/verification-sent";
import { ROUTES } from "@/lib/constants/routes";

type RegisterScreenProps = {
  demoMode?: boolean;
};

export function RegisterScreen({ demoMode = false }: RegisterScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const fromLink = searchParams.get("sent") === "1";
  const email =
    sentTo ??
    (fromLink ? (searchParams.get("email")?.trim().toLowerCase() ?? "") : null);

  function handleVerificationSent(address: string) {
    setSentTo(address);
    const params = new URLSearchParams({ sent: "1" });
    if (address) params.set("email", address);
    router.replace(`${ROUTES.register}?${params.toString()}`);
  }

  if (email !== null) {
    return (
      <AuthCard
        title="Verification email sent"
        subtitle="Agent workspace"
        description="Check your inbox. The link verifies your email and opens sign in."
      >
        <VerificationSent email={email} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Agent workspace">
      <RegisterForm
        demoMode={demoMode}
        onVerificationSent={handleVerificationSent}
      />
    </AuthCard>
  );
}
