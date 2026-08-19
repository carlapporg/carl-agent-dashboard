"use client";

import { useActionState, useMemo, useState } from "react";
import {
  changeAgentPasswordAction,
  type ChangePasswordState,
} from "@/features/profile/actions/profile-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { cn } from "@/lib/utils/cn";

function strengthLabel(password: string): {
  label: string;
  score: number;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (!password) return { label: "", score: 0 };
  if (score <= 2) return { label: "Weak", score: 1 };
  if (score <= 3) return { label: "Fair", score: 2 };
  if (score <= 4) return { label: "Good", score: 3 };
  return { label: "Strong", score: 4 };
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changeAgentPasswordAction,
    undefined as ChangePasswordState,
  );
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const strength = useMemo(() => strengthLabel(newPassword), [newPassword]);
  const mismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Password</p>
          <p className="mt-1 text-sm tracking-widest text-foreground-soft">
            ••••••••
          </p>
          <p className="mt-1 text-sm text-muted">
            Update your password regularly to keep the account secure.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Change password
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-1">
      {state?.message ? <Alert className="mb-3">{state.message}</Alert> : null}
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        hasError={Boolean(state?.errors?.currentPassword)}
        errorMessage={state?.errors?.currentPassword?.[0]}
        required
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        hasError={Boolean(state?.errors?.newPassword)}
        errorMessage={
          state?.errors?.newPassword?.[0] ||
          (newPassword && strength.score <= 1
            ? "Password does not meet requirements"
            : undefined)
        }
        required
      />
      {newPassword ? (
        <div className="-mt-2 mb-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  strength.score >= step ? "bg-accent" : "bg-surface-hover",
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{strength.label}</p>
        </div>
      ) : null}
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        hasError={Boolean(state?.errors?.confirmPassword) || mismatch}
        errorMessage={
          state?.errors?.confirmPassword?.[0] ||
          (mismatch ? "Passwords do not match" : undefined)
        }
        required
      />
      <p className="pb-2 text-xs text-muted-dim">
        After a successful change you’ll be signed out and asked to log in
        again.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Update password
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
