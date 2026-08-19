"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { loginAction } from "@/features/auth/actions/auth";
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
import { cn } from "@/lib/utils/cn";
import type { LoginFormState } from "@/types/auth";

type LoginFormProps = {
  demoMode?: boolean;
};

export function LoginForm({ demoMode = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    loginAction,
    undefined as LoginFormState,
  );
  const [isRedirecting, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | undefined>();
  const [infoMessage, setInfoMessage] = useState<string | undefined>();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const emailErrorId = useId();
  const bannerId = useId();
  const toastedMessage = useRef<string | undefined>(undefined);

  const canSubmit = isLoginFormValid(email, password);
  const isBusy = pending || showSuccess || isRedirecting;
  const nextPath = searchParams.get("next");

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchParams.get("passwordChanged") === "1") {
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
    if (state?.message) {
      setBannerMessage(state.message);
      setInfoMessage(undefined);
      alertRef.current?.focus();
      if (toastedMessage.current !== state.message) {
        toastedMessage.current = state.message;
        toast(state.message, "error");
      }
    }
  }, [state, toast]);

  useEffect(() => {
    if (!state?.success) return;

    setShowSuccess(true);
    const destination =
      nextPath &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      !nextPath.includes("://")
        ? nextPath
        : ROUTES.dashboard;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(destination);
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state?.success, router, nextPath]);

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

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      {bannerMessage || infoMessage ? (
        <div className="min-h-0" aria-live="polite">
          {bannerMessage ? (
            <div ref={alertRef} tabIndex={-1} id={bannerId}>
              <Alert>{bannerMessage}</Alert>
            </div>
          ) : infoMessage ? (
            <Alert variant="info">{infoMessage}</Alert>
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
        <p
          id={emailErrorId}
          className="mt-1.5 min-h-5 text-sm text-danger-foreground"
        >
          {emailError ?? ""}
        </p>
      </div>

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
        disabled={isBusy}
        required
      />

      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="rememberMe"
          disabled={isBusy}
          className="size-4 shrink-0 rounded border-border accent-[var(--accent)]"
        />
        <span>Remember me</span>
      </label>

      <Button
        type="submit"
        fullWidth
        loading={pending && !showSuccess}
        disabled={!canSubmit || pending || isRedirecting}
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

      {demoMode ? (
        <p className="text-center text-xs text-muted-dim">
          Local mock mode — API_BASE_URL is unset.
        </p>
      ) : null}
    </form>
  );
}
