"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  loginAction,
  resendVerificationAction,
} from "@/features/auth/actions/auth";
import { CheckIcon } from "@/features/auth/components/icons";
import {
  isLoginFormValid,
  validateEmailField,
  validatePasswordField,
} from "@/features/auth/schemas/login";
import { useToast } from "@/components/providers/toast-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { ROUTES } from "@/lib/constants/routes";
import { clearManualPresence } from "@/lib/agent/presence";
import { cn } from "@/lib/utils/cn";
import type { LoginFormState } from "@/types/auth";

type LoginFormProps = {
  demoMode?: boolean;
};

export function LoginForm({ demoMode = false }: LoginFormProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    loginAction,
    undefined as LoginFormState,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | undefined>();
  const [infoMessage, setInfoMessage] = useState<string | undefined>();
  const [infoVariant, setInfoVariant] = useState<"info" | "success">("info");
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | undefined>();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const emailErrorId = useId();
  const bannerId = useId();
  const toastedMessage = useRef<string | undefined>(undefined);

  const canSubmit = isLoginFormValid(email, password);
  const isBusy = pending || showSuccess;
  const nextPath = searchParams.get("next");

  useEffect(() => {
    const fromQuery = searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (fromQuery) setEmail(fromQuery);
    emailRef.current?.focus();
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      setInfoVariant("success");
      setInfoMessage("Email verified successfully");
    } else if (searchParams.get("verified") === "0") {
      setInfoVariant("info");
      setInfoMessage("That verification link is invalid or expired.");
      setShowResend(true);
    } else if (searchParams.get("reset") === "1") {
      setInfoVariant("success");
      setInfoMessage("Password reset successfully");
    } else if (searchParams.get("passwordChanged") === "1") {
      setInfoMessage("Password changed successfully. Please sign in again.");
    } else if (searchParams.get("expired") === "1") {
      setInfoMessage("Your session expired. Please sign in again.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (state?.errors?.email?.[0]) {
      setEmailError(state.errors.email[0]);
    }
    if (state?.errors?.password?.[0]) {
      setPasswordError(state.errors.password[0]);
    }
    if (state?.needsVerification) setShowResend(true);
    if (state?.message) {
      setBannerMessage(state.message);
      if (!state.needsVerification) setInfoMessage(undefined);
      alertRef.current?.focus();
      if (toastedMessage.current !== state.message) {
        toastedMessage.current = state.message;
        toast(state.message, "error");
      }
    }
  }, [state, toast]);

  useEffect(() => {
    if (!state?.success) return;

    clearManualPresence();
    setShowSuccess(true);
    const destination =
      nextPath &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      !nextPath.includes("://")
        ? nextPath
        : ROUTES.dashboard;
    const timer = window.setTimeout(() => {
      window.location.assign(destination);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state?.success, nextPath]);

  function handleSubmit(formData: FormData) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    formData.set("email", normalizedEmail);

    const nextEmailError = validateEmailField(normalizedEmail);
    const nextPasswordError = validatePasswordField(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setBannerMessage(undefined);

    if (nextEmailError || nextPasswordError) {
      if (nextEmailError) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    formAction(formData);
  }

  async function handleResend() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailError("Please enter your email address");
      emailRef.current?.focus();
      return;
    }
    if (resending) return;
    setResending(true);
    setResendNote(undefined);
    const result = await resendVerificationAction(normalized);
    setResending(false);
    setResendNote(
      result.ok ? "Verification email sent again." : result.message,
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      {bannerMessage || infoMessage ? (
        <div className="min-h-0" aria-live="polite">
          {bannerMessage ? (
            <div ref={alertRef} tabIndex={-1} id={bannerId}>
              <Alert>{bannerMessage}</Alert>
            </div>
          ) : infoMessage ? (
            <Alert variant={infoVariant}>{infoMessage}</Alert>
          ) : null}
        </div>
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
          disabled={isBusy}
          required
        />
        {emailError ? (
          <p
            id={emailErrorId}
            className="mt-1.5 text-sm text-danger-foreground"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <PasswordField
          ref={passwordRef}
          id="password"
          name="password"
          label="Password"
          autoComplete="off"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            const next = event.target.value;
            setPassword(next);
            if (passwordError) setPasswordError(validatePasswordField(next));
          }}
          onBlur={() => setPasswordError(validatePasswordField(password))}
          hasError={Boolean(passwordError)}
          errorMessage={passwordError}
          reserveErrorSpace={false}
          disabled={isBusy}
          required
        />

        <div className="flex justify-end">
          <Link
            href={ROUTES.forgotPassword}
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={pending && !showSuccess}
        disabled={!canSubmit || pending}
        className={cn("mt-1", showSuccess && "disabled:opacity-100")}
      >
        {showSuccess ? (
          <span className="inline-flex items-center gap-2">
            <CheckIcon className="size-4" />
            Signed in
          </span>
        ) : pending ? (
          "Signing in…"
        ) : (
          "Log in"
        )}
      </Button>

      {showResend ? (
        <div className="flex flex-col gap-2 text-center">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            loading={resending}
            onClick={() => {
              void handleResend();
            }}
          >
            Resend email
          </Button>
          {resendNote ? (
            <p className="text-sm text-muted" role="status">
              {resendNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {demoMode ? (
        <p className="text-center text-xs text-muted-dim">
          Local mock mode — API_BASE_URL is unset.
        </p>
      ) : null}
    </form>
  );
}
