"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
} from "react";
import {
  EyeIcon,
  EyeOffIcon,
} from "@/features/auth/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  hasError?: boolean;
  errorMessage?: string;
  hint?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      id,
      hasError,
      errorMessage,
      hint,
      className,
      disabled,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const [show, setShow] = useState(false);

    return (
      <div>
        <Label htmlFor={inputId}>{label}</Label>
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={show ? "text" : "password"}
            className={cn("pr-11", className)}
            hasError={hasError}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={
              [hasError && errorMessage ? errorId : null, hint ? hintId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            {...props}
          />
          <button
            type="button"
            className={cn(
              "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-md)] text-muted",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
            )}
            onClick={() => setShow((value) => !value)}
            aria-pressed={show}
            aria-label={show ? "Hide password" : "Show password"}
            disabled={disabled}
          >
            <span className="relative size-5">
              <EyeIcon
                className={cn(
                  "absolute inset-0 transition-opacity",
                  show ? "opacity-0" : "opacity-100",
                )}
              />
              <EyeOffIcon
                className={cn(
                  "absolute inset-0 transition-opacity",
                  show ? "opacity-100" : "opacity-0",
                )}
              />
            </span>
          </button>
        </div>
        {hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-muted-dim">
            {hint}
          </p>
        ) : null}
        <p
          id={errorId}
          className="mt-1.5 min-h-5 text-sm text-danger-foreground"
        >
          {hasError && errorMessage ? errorMessage : ""}
        </p>
      </div>
    );
  },
);
