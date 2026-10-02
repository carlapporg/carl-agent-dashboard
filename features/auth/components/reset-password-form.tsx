"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { resetPasswordAction } from "@/features/auth/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { USER_MESSAGES } from "@/lib/api/public-messages";
import { ROUTES } from "@/lib/constants/routes";
import type { ResetPasswordFormState } from "@/types/auth";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    undefined as ResetPasswordFormState,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const bannerId = useId();

  if (!token || state?.invalidLink) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Alert>{USER_MESSAGES.resetLinkInvalid}</Alert>
        <Link
          href={ROUTES.login}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  const shownPasswordError = passwordError ?? state?.errors?.newPassword?.[0];
  const shownConfirmError =
    confirmError ?? state?.errors?.confirmPassword?.[0];

  function handleSubmit(formData: FormData) {
    formData.set("token", token);
    let nextPasswordError: string | undefined;
    let nextConfirmError: string | undefined;
    if (password.length < 8) {
      nextPasswordError = USER_MESSAGES.passwordMinLength;
    }
    if (password !== confirmPassword) {
      nextConfirmError = USER_MESSAGES.passwordMismatch;
    }
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      {state?.message ? (
        <div id={bannerId}>
          <Alert>{state.message}</Alert>
        </div>
      ) : null}

      <input type="hidden" name="token" value={token} />

      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(event) => {
          const next = event.target.value;
          setPassword(next);
          if (passwordError) {
            setPasswordError(
              next.length >= 8 ? undefined : USER_MESSAGES.passwordMinLength,
            );
          }
          if (confirmError && confirmPassword) {
            setConfirmError(
              next === confirmPassword
                ? undefined
                : USER_MESSAGES.passwordMismatch,
            );
          }
        }}
        hasError={Boolean(shownPasswordError)}
        errorMessage={shownPasswordError}
        disabled={pending}
        required
        minLength={8}
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChange={(event) => {
          const next = event.target.value;
          setConfirmPassword(next);
          if (confirmError) {
            setConfirmError(
              next === password ? undefined : USER_MESSAGES.passwordMismatch,
            );
          }
        }}
        hasError={Boolean(shownConfirmError)}
        errorMessage={shownConfirmError}
        disabled={pending}
        required
        minLength={8}
      />

      <Button type="submit" fullWidth loading={pending} disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>

      {state?.invalidToken ? (
        <p className="text-center text-sm text-muted">
          <Link
            href={ROUTES.forgotPassword}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Forgot password?
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-muted">
          <Link
            href={ROUTES.login}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Back to sign in
          </Link>
        </p>
      )}
    </form>
  );
}
