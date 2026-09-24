"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { ChevronIcon } from "@/components/ui/chevron-icon";
import {
  dropdownItemClass,
  dropdownPanelClass,
} from "@/components/ui/dropdown-styles";
import { cn } from "@/lib/utils/cn";

export type SelectFieldOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps<T extends string = string> = {
  id?: string;
  value: T;
  options: ReadonlyArray<SelectFieldOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  /** Match closed control width to menu (full width forms). */
  matchTriggerWidth?: boolean;
  "aria-label"?: string;
};

export function SelectField<T extends string = string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select…",
  className,
  triggerClassName,
  menuClassName,
  matchTriggerWidth = true,
  "aria-label": ariaLabel,
}: SelectFieldProps<T>) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuMinWidth, setMenuMinWidth] = useState<number | undefined>();

  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    if (matchTriggerWidth && triggerRef.current) {
      setMenuMinWidth(triggerRef.current.getBoundingClientRect().width);
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, matchTriggerWidth, open]);

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-[45px] w-full items-center justify-between gap-2 rounded-[5px] border border-border bg-surface px-[15px] text-left text-[14px] font-normal tracking-[-0.05em] text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
          triggerClassName,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted")}>
          {label}
        </span>
        <ChevronIcon
          className={cn(
            "size-[15px] shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnchoredMenu
        open={open}
        triggerRef={triggerRef}
        menuRef={menuRef}
        id={menuId}
        role="listbox"
        aria-label={ariaLabel}
        align="left"
        className={cn(dropdownPanelClass, menuClassName)}
      >
        <div
          style={menuMinWidth ? { minWidth: menuMinWidth } : undefined}
          className="max-h-64 overflow-y-auto"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const isDisabled = Boolean(option.disabled);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(option.value);
                  close(true);
                }}
                className={dropdownItemClass({
                  selected: isSelected,
                  disabled: isDisabled,
                })}
              >
                <span
                  className={cn(
                    "flex w-4 shrink-0 justify-center text-[12px]",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </AnchoredMenu>
    </div>
  );
}
