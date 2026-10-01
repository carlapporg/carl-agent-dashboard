"use client";

import Link from "next/link";
import { useState } from "react";
import { resendVerificationAction } from "@/features/auth/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

type VerificationSentProps = {
  email: string;
};

export function VerificationSent({ email }: VerificationSentProps) {
  const [resending, setResending] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  async function handleResend() {
    if (resending || !email) return;
    setResending(true);
    setNote(undefined);
    const result = await resendVerificationAction(email);
    setResending(false);
    setNote(result.ok ? "Verification email sent again." : result.message);
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <Alert variant="success">Verification email sent</Alert>
      <p className="text-sm leading-relaxed text-muted">
        We sent a link to{" "}
        <span className="font-medium text-foreground">
          {email || "your email"}
        </span>
        . Open that link. It will verify your email and take you to sign in.
      </p>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={resending}
        onClick={() => {
          void handleResend();
        }}
      >
        Resend verification email
      </Button>
      {note ? (
        <p className="text-sm text-muted" role="status">
          {note}
        </p>
      ) : null}
      <Link
        href={ROUTES.login}
        className="text-sm font-semibold text-accent hover:text-accent-hover"
      >
        Go to sign in
      </Link>
    </div>
  );
}
