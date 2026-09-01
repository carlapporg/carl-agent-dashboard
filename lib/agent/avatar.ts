import type { BackendUser } from "@/types/user";

/** Cache-bust public Supabase avatar URLs after re-upload. */
export function avatarSrc(
  user: Pick<BackendUser, "avatarUrl" | "updatedAt">,
): string | undefined {
  const raw = user.avatarUrl?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  const stamp = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
  if (!Number.isFinite(stamp)) return raw;
  const join = raw.includes("?") ? "&" : "?";
  return `${raw}${join}v=${stamp}`;
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/jpg";

export function validateAvatarFile(file: File): string | null {
  if (!file.size) return "Choose an image to upload.";
  if (file.size > AVATAR_MAX_BYTES) return "Image must be 5 MB or smaller.";
  const type = file.type.toLowerCase();
  if (!type.startsWith("image/")) return "Upload a JPG, PNG, or WebP image.";
  return null;
}
