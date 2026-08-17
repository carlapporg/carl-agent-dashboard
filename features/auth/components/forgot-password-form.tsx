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
    if (!state?.success) {
      emailRef.current?.focus();
    }
  }, [state?.success]);

  useEffect(() => {
    if (state?.errors?.email?.[0]) {
      setEmailError(state.errors.email[0]);
    }
  }, [state]);

  function handleSubmit(formData: FormData) {
    const nextError = validateEmailField(email);
    setEmailError(nextError);
    if (nextError) {
      emailRef.current?.focus();
      return;
    }
    formAction(formData);
  }

  if (state?.success) {
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="info">{state.message}</Alert>
        <p className="text-sm leading-relaxed text-muted">
          Check your inbox in a few minutes. If nothing arrives, ask your team
          lead to confirm your account email.
        </p>
        <Link
          href={ROUTES.login}
          className="inline-flex h-14 items-center justify-center rounded-xl border border-border bg-surface-elevated text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5" noValidate>
      <p className="text-sm leading-relaxed text-muted">
        Enter the email on your agent account. If it exists, we&apos;ll send a
        reset link.
      </p>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError(undefined);
          }}
          onBlur={() => setEmailError(validateEmailField(email))}
          hasError={Boolean(emailError)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? emailErrorId : undefined}
          disabled={pending}
          required
        />
        <p
          id={emailErrorId}
          className="mt-2 min-h-5 text-sm text-danger-foreground"
        >
          {emailError ?? ""}
        </p>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={pending}
        disabled={email.trim().length === 0 || pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        href={ROUTES.login}
        className="inline-flex min-h-11 items-center justify-center text-sm text-muted transition-colors duration-150 hover:text-accent focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        Back to log in
      </Link>
    </form>
  );
}
