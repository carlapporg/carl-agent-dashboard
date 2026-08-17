"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { loginAction } from "@/features/auth/actions/auth";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/features/auth/components/icons";
import {
  isLoginFormValid,
  validateEmailField,
  validatePasswordField,
} from "@/features/auth/schemas/login";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { LoginFormState } from "@/types/auth";

type LoginFormProps = {
  demoMode?: boolean;
};

export function LoginForm({ demoMode = false }: LoginFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    loginAction,
    undefined as LoginFormState,
  );
  const [isRedirecting, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | undefined>();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const bannerId = useId();

  const canSubmit = isLoginFormValid(email, password);
  const isBusy = pending || showSuccess || isRedirecting;

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state?.errors?.email?.[0]) {
      setEmailError(state.errors.email[0]);
    }
    if (state?.errors?.password?.[0]) {
      setPasswordError(state.errors.password[0]);
    }
    if (state?.message) {
      setBannerMessage(state.message);
      alertRef.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (!state?.success) return;

    setShowSuccess(true);
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(ROUTES.dashboard);
        router.refresh();
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state?.success, router]);

  function handleEmailBlur() {
    setEmailError(validateEmailField(email));
  }

  function handlePasswordBlur() {
    setPasswordError(validatePasswordField(password));
  }

  function handleSubmit(formData: FormData) {
    const nextEmailError = validateEmailField(email);
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
    <form action={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="min-h-[3.25rem]" aria-live="polite">
        {bannerMessage ? (
          <div ref={alertRef} tabIndex={-1} id={bannerId}>
            <Alert>{bannerMessage}</Alert>
          </div>
        ) : null}
      </div>

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
            const next = event.target.value;
            setEmail(next);
            if (emailError) setEmailError(validateEmailField(next));
          }}
          onBlur={handleEmailBlur}
          hasError={Boolean(emailError)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? emailErrorId : undefined}
          disabled={isBusy}
          required
        />
        <p
          id={emailErrorId}
          className="mt-2 min-h-5 text-sm text-danger-foreground"
        >
          {emailError ?? ""}
        </p>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            className="pr-12"
            value={password}
            onChange={(event) => {
              const next = event.target.value;
              setPassword(next);
              if (passwordError) setPasswordError(validatePasswordField(next));
            }}
            onBlur={handlePasswordBlur}
            hasError={Boolean(passwordError)}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            disabled={isBusy}
            required
          />
          <button
            type="button"
            className={cn(
              "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors duration-150 ease-out",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
            )}
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={isBusy}
          >
            <span className="relative size-5">
              <EyeIcon
                className={cn(
                  "absolute inset-0 transition-opacity duration-150 ease-out",
                  showPassword ? "opacity-0" : "opacity-100",
                )}
              />
              <EyeOffIcon
                className={cn(
                  "absolute inset-0 transition-opacity duration-150 ease-out",
                  showPassword ? "opacity-100" : "opacity-0",
                )}
              />
            </span>
          </button>
        </div>
        <p
          id={passwordErrorId}
          className="mt-2 min-h-5 text-sm text-danger-foreground"
        >
          {passwordError ?? ""}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-muted transition-colors duration-150 hover:text-foreground-soft">
          <input
            type="checkbox"
            name="rememberMe"
            disabled={isBusy}
            className="size-4 shrink-0 rounded border-border bg-surface-elevated accent-[var(--accent)]"
          />
          <span>Remember me</span>
        </label>

        <Link
          href={ROUTES.forgotPassword}
          className="inline-flex min-h-11 items-center text-sm text-muted transition-colors duration-150 hover:text-accent focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={pending && !showSuccess}
        disabled={!canSubmit || pending || isRedirecting}
        className={cn("mt-1", showSuccess && "disabled:opacity-100")}
      >
        {showSuccess ? (
          <span className="inline-flex items-center gap-2">
            <CheckIcon className="size-5" />
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
          Demo mode — use a valid email and a password with 6+ characters and a
          number.
        </p>
      ) : null}
    </form>
  );
}
