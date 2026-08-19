"use client";

import { useEffect, useRef, useState } from "react";
import { useUpdateAgentName } from "@/features/agents/hooks";
import { useToast } from "@/components/providers/toast-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditNameFormProps = {
  firstName: string;
  lastName: string;
};

export function EditNameForm({ firstName, lastName }: EditNameFormProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const updateName = useUpdateAgentName();
  const didToast = useRef(false);

  useEffect(() => {
    if (!updateName.isSuccess || didToast.current) return;
    didToast.current = true;
    toast("Profile updated successfully", "success");
    setEditing(false);
  }, [updateName.isSuccess, toast]);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Display name</p>
          <p className="mt-1 text-sm text-foreground-soft">
            {[firstName, lastName].filter(Boolean).join(" ") || "—"}
          </p>
          <p className="mt-1 text-sm text-muted">
            This name appears in the header and on task activity.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            didToast.current = false;
            setEditing(true);
          }}
        >
          Edit name
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        updateName.mutate(new FormData(event.currentTarget));
      }}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">Edit name</p>
        <p className="mt-1 text-sm text-muted">
          Update how teammates see you in the dashboard.
        </p>
      </div>
      {updateName.isError ? (
        <Alert>
          {updateName.error instanceof Error
            ? updateName.error.message
            : "Couldn’t save your name."}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={lastName} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={updateName.isPending}>
          Save name
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={updateName.isPending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
