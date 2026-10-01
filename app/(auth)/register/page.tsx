import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterScreen } from "@/features/auth/components/register-screen";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterScreen demoMode={!env.isApiConfigured} />
    </Suspense>
  );
}
