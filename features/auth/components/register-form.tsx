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
import { registerAction } from "@/features/auth/actions/auth";
import { CheckIcon } from "@/features/auth/components/icons";
import { PasswordChecks } from "@/features/auth/components/password-checks";
import {
  isRegisterFormValid,
  validateRegisterConfirmPassword,
  validateRegisterEmail,
  validateRegisterFirstName,
  validateRegisterPassword,
} from "@/features/auth/schemas/register";
import { useToast } from "@/components/providers/toast-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { RegisterFormState } from "@/types/auth";

type RegisterFormProps = {
  demoMode?: boolean;
};

export function RegisterForm({ demoMode = false }: RegisterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    registerAction,
    undefined as RegisterFormState,
  );
  const [isRedirecting, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | undefined
  >();
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [lastNameError, setLastNameError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | undefined>();

  const emailRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const emailErrorId = useId();
  const bannerId = useId();
  const toastedMessage = useRef<string | undefined>(undefined);

  const canSubmit = isRegisterFormValid(
    email,
    password,
    confirmPassword,
    firstName,
  );
  const isBusy = pending || showSuccess || isRedirecting;

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state?.errors?.email?.[0]) setEmailError(state.errors.email[0]);
    if (state?.errors?.password?.[0]) setPasswordError(state.errors.password[0]);
    if (state?.errors?.confirmPassword?.[0]) {
      setConfirmPasswordError(state.errors.confirmPassword[0]);
    }
    if (state?.errors?.firstName?.[0]) {
      setFirstNameError(state.errors.firstName[0]);
    }
    if (state?.errors?.lastName?.[0]) setLastNameError(state.errors.lastName[0]);

    if (state?.message) {
      setBannerMessage(state.message);
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
    toast("Account created. Welcome to Carl!", "success");
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(ROUTES.dashboard);
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state?.success, router, toast]);

  function handleSubmit(formData: FormData) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    formData.set("email", normalizedEmail);

    const nextEmailError = validateRegisterEmail(normalizedEmail);
    const nextPasswordError = validateRegisterPassword(password);
    const nextConfirmError = validateRegisterConfirmPassword(
      password,
      confirmPassword,
    );
    const nextFirstNameError = validateRegisterFirstName(firstName);

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmError);
    setFirstNameError(nextFirstNameError);
    setBannerMessage(undefined);

    if (
      nextEmailError ||
      nextPasswordError ||
      nextConfirmError ||
      nextFirstNameError
    ) {
      if (nextEmailError) emailRef.current?.focus();
      return;
    }

    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      {bannerMessage ? (
        <div className="min-h-0" aria-live="polite">
          <div ref={alertRef} tabIndex={-1} id={bannerId}>
            <Alert>{bannerMessage}</Alert>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            placeholder="Olivia"
            value={firstName}
            onChange={(event) => {
              const next = event.target.value;
              setFirstName(next);
              if (firstNameError) {
                setFirstNameError(validateRegisterFirstName(next));
              }
            }}
            onBlur={() =>
              setFirstNameError(validateRegisterFirstName(firstName))
            }
            hasError={Boolean(firstNameError)}
            disabled={isBusy}
            required
          />
          <p className="mt-1.5 min-h-5 text-sm text-danger-foreground">
            {firstNameError ?? ""}
          </p>
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            placeholder="Martinez"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            hasError={Boolean(lastNameError)}
            disabled={isBusy}
          />
          <p className="mt-1.5 min-h-5 text-sm text-danger-foreground">
            {lastNameError ?? ""}
          </p>
        </div>
      </div>

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
            if (emailError) setEmailError(validateRegisterEmail(next));
          }}
          onBlur={() => {
            const normalized = email.trim().toLowerCase();
            if (normalized !== email) setEmail(normalized);
            setEmailError(validateRegisterEmail(normalized));
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
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="Create a password"
        value={password}
        onChange={(event) => {
          const next = event.target.value;
          setPassword(next);
          if (passwordError) {
            setPasswordError(next ? undefined : validateRegisterPassword(next));
          }
          if (confirmPasswordError && confirmPassword) {
            setConfirmPasswordError(
              validateRegisterConfirmPassword(next, confirmPassword),
            );
          }
        }}
        onBlur={() =>
          setPasswordError(password ? undefined : validateRegisterPassword(password))
        }
        hasError={Boolean(passwordError)}
        errorMessage={passwordError}
        reserveErrorSpace={false}
        disabled={isBusy}
        required
      />

      <PasswordChecks password={password} />

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
          if (confirmPasswordError) {
            setConfirmPasswordError(
              validateRegisterConfirmPassword(password, next),
            );
          }
        }}
        onBlur={() =>
          setConfirmPasswordError(
            validateRegisterConfirmPassword(password, confirmPassword),
          )
        }
        hasError={Boolean(confirmPasswordError)}
        errorMessage={confirmPasswordError}
        disabled={isBusy}
        required
      />

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
            Account created
          </span>
        ) : pending ? (
          "Creating account…"
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={ROUTES.login}
          className="font-semibold text-accent hover:text-accent-hover"
        >
          Sign in
        </Link>
      </p>

      {demoMode ? (
        <p className="text-center text-xs text-muted-dim">
          Local mock mode — API_BASE_URL is unset.
        </p>
      ) : null}
    </form>
  );
}
