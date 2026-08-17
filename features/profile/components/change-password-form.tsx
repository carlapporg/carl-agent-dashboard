"use client";

import { useActionState, useState } from "react";
import {
  changeAgentPasswordAction,
  type ChangePasswordState,
} from "@/features/profile/actions/profile-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changeAgentPasswordAction,
    undefined as ChangePasswordState,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Password</p>
          <p className="text-base text-foreground-soft">••••••••</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Change password
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.message ? <Alert>{state.message}</Alert> : null}
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          hasError={Boolean(state?.errors?.currentPassword)}
          required
        />
        {state?.errors?.currentPassword?.[0] ? (
          <p className="mt-1.5 text-sm text-danger-foreground">
            {state.errors.currentPassword[0]}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(state?.errors?.newPassword)}
          required
        />
        {state?.errors?.newPassword?.[0] ? (
          <p className="mt-1.5 text-sm text-danger-foreground">
            {state.errors.newPassword[0]}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(state?.errors?.confirmPassword)}
          required
        />
        {state?.errors?.confirmPassword?.[0] ? (
          <p className="mt-1.5 text-sm text-danger-foreground">
            {state.errors.confirmPassword[0]}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-muted-dim">
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
