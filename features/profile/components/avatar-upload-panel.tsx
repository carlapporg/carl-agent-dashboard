"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadAgentAvatarAction } from "@/features/profile/actions/profile-actions";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AVATAR_ACCEPT, validateAvatarFile } from "@/lib/agent/avatar";
import { queryKeys } from "@/lib/query/keys";
import type { BackendUser } from "@/types/user";

type AvatarUploadPanelProps = {
  user: BackendUser;
};

export function AvatarUploadPanel({ user }: AvatarUploadPanelProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(user);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const displayUser = preview
    ? { ...current, avatarUrl: preview, updatedAt: new Date().toISOString() }
    : current;

  async function onPick(file: File) {
    setMessage(undefined);
    setError(undefined);
    const validation = validateAvatarFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    const form = new FormData();
    form.set("file", file);

    try {
      const result = await uploadAgentAvatarAction(undefined, form);
      if (!result?.success || !result.user) {
        setError(result?.message ?? "Couldn’t upload your photo.");
        setPreview(null);
        return;
      }
      setCurrent(result.user);
      setPreview(null);
      queryClient.setQueryData(queryKeys.agents.me(), result.user);
      setMessage("Profile photo updated.");
    } catch {
      setError("Couldn’t upload your photo. Try again.");
      setPreview(null);
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void onPick(file);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <AgentAvatar user={displayUser} size="xl" />

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Profile photo</h2>
          <p className="mt-1 text-sm text-muted">
            JPG, PNG, or WebP. Max 5 MB. Re-upload replaces your current photo.
          </p>
        </div>

        {error ? <Alert>{error}</Alert> : null}
        {message ? <Alert variant="info">{message}</Alert> : null}

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            aria-label="Upload profile photo"
            disabled={uploading}
            onChange={onInputChange}
          />
          <Button
            type="button"
            variant="secondary"
            loading={uploading}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {current.avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
