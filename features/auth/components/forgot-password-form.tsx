"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { forgotPasswordAction } from "@/features/auth/actions/auth";
import { validateEmailField } from "@/features/auth/schemas/login";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants/routes";
import type { ForgotPasswordFormState } from "@/types/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    undefined as ForgotPasswordFormState,
  );
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const emailRef = useRef<HTMLInputElement>(null);
  const emailErrorId = useId();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  function handleSubmit(formData: FormData) {
    const normalized = email.trim().toLowerCase();
    if (normalized !== email) setEmail(normalized);
    formData.set("email", normalized);
    const nextError = validateEmailField(normalized);
    setEmailError(nextError);
    if (nextError) {
      emailRef.current?.focus();
      return;
    }
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      {state?.message ? (
        <Alert variant={state.success ? "success" : "error"}>
          {state.message}
        </Alert>
      ) : null}

      {state?.success ? (
        <p className="text-sm leading-relaxed text-muted">
          The email subject is “Reset your Carl password”. The link expires in
          1 hour.
        </p>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => {
            const next = event.target.value;
            setEmail(next);
            if (emailError) setEmailError(validateEmailField(next));
          }}
          onBlur={() => {
            const normalized = email.trim().toLowerCase();
            if (normalized !== email) setEmail(normalized);
            setEmailError(validateEmailField(normalized));
          }}
          hasError={Boolean(emailError)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? emailErrorId : undefined}
          disabled={pending}
          required
        />
        <p
          id={emailErrorId}
          className="mt-1.5 min-h-5 text-sm text-danger-foreground"
        >
          {emailError ?? ""}
        </p>
      </div>

      <Button type="submit" fullWidth loading={pending} disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link
          href={ROUTES.login}
          className="font-semibold text-accent hover:text-accent-hover"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
