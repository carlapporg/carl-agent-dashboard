"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "info" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  placement?: "top" | "bottom";
  title?: string;
};

type ToastContextValue = {
  toast: (
    message: string,
    variant?: ToastVariant,
    options?: { placement?: "top" | "bottom"; title?: string },
  ) => void;
  comingSoon: (message?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-border bg-surface text-foreground-soft",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options?: { placement?: "top" | "bottom"; title?: string },
    ) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const placement = options?.placement ?? "bottom";
      setItems((prev) => {
        const kept =
          placement === "top"
            ? prev.filter((item) => item.placement !== "top")
            : prev;
        return [...kept, { id, message, variant, placement, title: options?.title }].slice(
          -4,
        );
      });
      window.setTimeout(() => dismiss(id), placement === "top" ? 4500 : 3500);
    },
    [dismiss],
  );

  const comingSoon = useCallback(
    (message = "This feature is coming soon") => {
      toast(message, "info");
    },
    [toast],
  );

  const value = useMemo(() => ({ toast, comingSoon }), [toast, comingSoon]);

  const topItems = items.filter((item) => item.placement === "top");
  const bottomItems = items.filter((item) => item.placement !== "top");

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted ? (
        <>
          <div
            className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(100%-2rem,24rem)] flex-col items-end gap-2 sm:top-5 sm:right-5"
            aria-live="polite"
            suppressHydrationWarning
          >
            {topItems.map((item) => (
              <div
                key={item.id}
                role="status"
                className="dash-notify-glow pointer-events-auto w-full overflow-hidden rounded-2xl border-2 border-accent/40 bg-surface shadow-[0_12px_40px_rgba(79,124,255,0.22),0_4px_14px_rgba(0,0,0,0.08)]"
              >
                <div className="flex gap-3.5 bg-accent/[0.06] px-4 py-3.5">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm ring-4 ring-accent/20">
                    <span className="size-2.5 rounded-full bg-white dash-live-dot" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                      {item.title ?? "New task"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground">
                      {item.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="shrink-0 rounded-lg px-2 text-lg leading-none text-muted hover:bg-accent/10 hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
                <div className="h-1 w-full bg-accent/15">
                  <div className="dash-toast-bar h-full bg-accent" />
                </div>
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
            aria-live="polite"
            suppressHydrationWarning
          >
            {bottomItems.map((item) => (
              <div
                key={item.id}
                role="status"
                className={cn(
                  "pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-soft)]",
                  VARIANT_STYLES[item.variant],
                )}
              >
                {item.message}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
