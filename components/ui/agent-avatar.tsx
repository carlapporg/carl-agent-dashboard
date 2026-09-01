"use client";

import { avatarSrc } from "@/lib/agent/avatar";
import { cn } from "@/lib/utils/cn";
import { getAgentInitials, type BackendUser } from "@/types/user";

type AgentAvatarProps = {
  user: Pick<
    BackendUser,
    "firstName" | "lastName" | "email" | "avatarUrl" | "updatedAt"
  >;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

export function AgentAvatar({
  user,
  size = "md",
  className,
}: AgentAvatarProps) {
  const src = avatarSrc(user);
  const initials = getAgentInitials(user);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public Supabase URLs vary by project host
      <img
        src={src}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-border",
          SIZE_CLASS[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent ring-1 ring-border",
        SIZE_CLASS[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
