import { cn } from "@/lib/utils/cn";

/** White option panel — light surface with dark text. */
export const dropdownPanelClass =
  "rounded-[12px] border border-dropdown-border bg-dropdown p-1.5 text-dropdown-foreground shadow-[var(--shadow-dropdown)]";

export const dropdownItemBaseClass =
  "flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left text-[13px] font-medium tracking-[-0.02em] outline-none transition-colors";

export function dropdownItemClass(opts: {
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { selected, disabled, className } = opts;
  return cn(
    dropdownItemBaseClass,
    disabled
      ? "cursor-not-allowed text-dropdown-muted"
      : selected
        ? "bg-dropdown-selected text-dropdown-foreground"
        : "text-dropdown-foreground hover:bg-dropdown-hover",
    className,
  );
}
