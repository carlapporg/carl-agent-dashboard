"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { useComingSoon } from "@/hooks/use-coming-soon";

type ComingSoonButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  message?: string;
};

export function ComingSoonButton({
  message,
  onClick,
  children,
  ...props
}: ComingSoonButtonProps) {
  const comingSoon = useComingSoon();

  return (
    <Button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          comingSoon(message);
        }
      }}
    >
      {children}
    </Button>
  );
}
