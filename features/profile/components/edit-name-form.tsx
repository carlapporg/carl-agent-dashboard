"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateAgentNameAction,
  type ProfileNameState,
} from "@/features/profile/actions/profile-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";

type EditNameFormProps = {
  firstName: string;
  lastName: string;
};

export function EditNameForm({ firstName, lastName }: EditNameFormProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    updateAgentNameAction,
    undefined as ProfileNameState,
  );

  useEffect(() => {
    if (state?.success) {
      toast(state.message ?? "Name updated.", "success");
      setEditing(false);
    }
  }, [state, toast]);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Name</p>
          <p className="text-base text-foreground-soft">
            {[firstName, lastName].filter(Boolean).join(" ") || "—"}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          Edit name
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.message && !state.success ? <Alert>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            hasError={Boolean(state?.errors?.firstName)}
            required
          />
          {state?.errors?.firstName?.[0] ? (
            <p className="mt-1.5 text-sm text-danger-foreground">
              {state.errors.firstName[0]}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lastName}
            hasError={Boolean(state?.errors?.lastName)}
          />
          {state?.errors?.lastName?.[0] ? (
            <p className="mt-1.5 text-sm text-danger-foreground">
              {state.errors.lastName[0]}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Save name
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
