"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils/cn";

export type FilterPillOption<T extends string = string> = {
  value: T;
  label: string;
};

type FilterPillProps<T extends string = string> = {
  label: string;
  value: T;
  options: ReadonlyArray<FilterPillOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  /** Shorter trigger padding for compact Figma pills (Status / Today). */
  compact?: boolean;
};

/** Figma gray dropdown pill — reused for Status, Today, month filters. */
export function FilterPill<T extends string = string>({
  label,
  value,
  options,
  onChange,
  className,
  compact = false,
}: FilterPillProps<T>) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected =
    options.find((option) => option.value === value)?.label ?? label;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

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
  }, [close, open]);

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex h-[35px] items-center gap-2 rounded-[40px] bg-[#f6f6f6] text-[12px] font-medium tracking-[-0.05em] text-black",
          compact ? "pl-[25px] pr-2" : "pl-4 pr-2",
        )}
      >
        <span>{selected}</span>
        <span className="flex size-[29px] items-center justify-center rounded-full bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/dashboard/chevron.svg"
            alt=""
            width={15}
            height={15}
            className={cn(
              "size-[15px] transition-transform",
              open ? "-rotate-90" : "rotate-90",
            )}
          />
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 z-50 mt-2 min-w-[10.5rem] rounded-[12px] border border-[#e7e7e7] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onChange(option.value);
                  close(true);
                }}
                className={cn(
                  "flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[12px] font-medium tracking-[-0.02em]",
                  isSelected
                    ? "bg-[#f6f6f6] text-[#1f1f21]"
                    : "text-[rgba(0,0,0,0.55)] hover:bg-[#f6f6f6] hover:text-[#1f1f21]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
