"use client";

import {
  CheckIcon,
  CloseIcon,
} from "@/features/auth/components/icons";
import { passwordCheckResults } from "@/features/auth/schemas/register";
import { cn } from "@/lib/utils/cn";

type PasswordChecksProps = {
  password: string;
};

export function PasswordChecks({ password }: PasswordChecksProps) {
  const checks = passwordCheckResults(password);

  return (
    <ul className="flex flex-col gap-1.5" aria-live="polite">
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            "flex items-center gap-2 text-sm",
            check.met ? "text-success" : "text-muted-dim",
          )}
        >
          {check.met ? (
            <CheckIcon className="size-3.5 shrink-0" />
          ) : (
            <CloseIcon className="size-3.5 shrink-0" />
          )}
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
}
