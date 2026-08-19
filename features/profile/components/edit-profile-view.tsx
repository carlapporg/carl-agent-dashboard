"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateAgentNameAction } from "@/features/profile/actions/profile-actions";
import { CheckIcon } from "@/features/auth/components/icons";
import { useToast } from "@/components/providers/toast-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { ROUTES } from "@/lib/constants/routes";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";
import type { ProfileNameState } from "@/features/profile/actions/profile-actions";
import type { BackendUser } from "@/types/user";

type EditProfileFormProps = {
  user: BackendUser;
};

export function EditProfileView({ user }: EditProfileFormProps) {
  return (
    <PageShell wide>
      <Link
        href={ROUTES.profile}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to profile
      </Link>

      <PageHeader
        title="Edit profile"
        description="Update your display name. Your email is managed by your admin."
      />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardBody>
            <EditProfileForm user={user} />
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}

function EditProfileForm({ user }: EditProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, formAction, pending] = useActionState(
    updateAgentNameAction,
    undefined as ProfileNameState,
  );
  const [isRedirecting, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [lastNameError, setLastNameError] = useState<string | undefined>();
  const [bannerMessage, setBannerMessage] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);
  const toastedMessage = useRef<string | undefined>(undefined);

  const isBusy = pending || showSuccess || isRedirecting;
  const canSubmit = firstName.trim().length > 0;

  useEffect(() => {
    if (state?.errors?.firstName?.[0]) {
      setFirstNameError(state.errors.firstName[0]);
    }
    if (state?.errors?.lastName?.[0]) {
      setLastNameError(state.errors.lastName[0]);
    }
    if (state?.message) {
      setBannerMessage(state.message);
      if (toastedMessage.current !== state.message) {
        toastedMessage.current = state.message;
        toast(state.message, "error");
      }
    }
  }, [state, toast]);

  useEffect(() => {
    if (!state?.success || !state.user) return;

    setShowSuccess(true);
    queryClient.setQueryData(queryKeys.agents.me(), state.user);
    toast("Profile updated successfully", "success");

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(ROUTES.profile);
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [state?.success, state?.user, queryClient, router, toast]);

  function handleSubmit(formData: FormData) {
    setBannerMessage(undefined);
    setFirstNameError(undefined);
    setLastNameError(undefined);

    if (!firstName.trim()) {
      setFirstNameError("Enter your first name");
      return;
    }

    formData.set("firstName", firstName.trim());
    formData.set("lastName", lastName.trim());
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      {bannerMessage ? (
        <Alert>{bannerMessage}</Alert>
      ) : state?.success ? (
        <Alert variant="info">Profile saved. Redirecting…</Alert>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={user.email}
          disabled
          readOnly
          className="bg-surface-hover text-muted"
        />
        <p className="mt-1 text-xs text-muted-dim">
          Email cannot be changed here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              if (firstNameError) setFirstNameError(undefined);
            }}
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
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              if (lastNameError) setLastNameError(undefined);
            }}
            hasError={Boolean(lastNameError)}
            disabled={isBusy}
          />
          <p className="mt-1.5 min-h-5 text-sm text-danger-foreground">
            {lastNameError ?? ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button
          type="submit"
          loading={pending && !showSuccess}
          disabled={!canSubmit || isBusy}
          className={cn(showSuccess && "disabled:opacity-100")}
        >
          {showSuccess ? (
            <span className="inline-flex items-center gap-2">
              <CheckIcon className="size-4" />
              Saved
            </span>
          ) : pending ? (
            "Saving…"
          ) : (
            "Save changes"
          )}
        </Button>
        <Link href={ROUTES.profile}>
          <Button type="button" variant="ghost" disabled={isBusy}>
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
