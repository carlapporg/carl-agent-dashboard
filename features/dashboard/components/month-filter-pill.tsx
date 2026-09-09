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

const MONTH_OPTIONS = [
  "This week",
  "This month",
  "Last month",
  "This quarter",
  "This year",
] as const;

export type MonthFilterValue = (typeof MONTH_OPTIONS)[number];

type MonthFilterPillProps = {
  value?: MonthFilterValue;
  onChange?: (value: MonthFilterValue) => void;
  className?: string;
};

export function MonthFilterPill({
  value: controlled,
  onChange,
  className,
}: MonthFilterPillProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<MonthFilterValue>("This month");
  const value = controlled ?? internal;

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

  function select(next: MonthFilterValue) {
    if (controlled === undefined) setInternal(next);
    onChange?.(next);
    close(true);
  }

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
        aria-label={`Time range: ${value}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-[35px] items-center gap-2 rounded-[40px] bg-[#f6f6f6] pl-4 pr-2 text-[12px] font-medium tracking-[-0.05em] text-black"
      >
        <span>{value}</span>
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
          aria-label="Time range"
          className="absolute right-0 z-50 mt-2 min-w-[10.5rem] rounded-[12px] border border-[#e7e7e7] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          {MONTH_OPTIONS.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => select(option)}
                className={cn(
                  "flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[12px] font-medium tracking-[-0.02em]",
                  selected
                    ? "bg-[#f6f6f6] text-[#1f1f21]"
                    : "text-[rgba(0,0,0,0.55)] hover:bg-[#f6f6f6] hover:text-[#1f1f21]",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
