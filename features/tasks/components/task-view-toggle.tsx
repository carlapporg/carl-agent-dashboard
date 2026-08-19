"use client";

import { cn } from "@/lib/utils/cn";

export type TasksViewMode = "list" | "board";

const VIEW_STORAGE_KEY = "carl.tasks.view";

export function readStoredTasksView(): TasksViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const value = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (value === "board" || value === "list") return value;
  } catch {
    /* ignore */
  }
  return "list";
}

export function storeTasksView(mode: TasksViewMode) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

type TaskViewToggleProps = {
  value: TasksViewMode;
  onChange: (mode: TasksViewMode) => void;
};

export function TaskViewToggle({ value, onChange }: TaskViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-surface p-1"
      role="group"
      aria-label="Tasks view"
    >
      {(
        [
          { id: "list", label: "List" },
          { id: "board", label: "Board" },
        ] as const
      ).map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-4 py-2 text-base font-semibold transition-colors",
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
