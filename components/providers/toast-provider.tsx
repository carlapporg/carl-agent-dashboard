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
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "info" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  placement?: "top" | "bottom";
  title?: string;
  href?: string;
  actionLabel?: string;
};

type ToastOptions = {
  placement?: "top" | "bottom";
  title?: string;
  href?: string;
  actionLabel?: string;
  stack?: boolean;
};

type ToastContextValue = {
  toast: (
    message: string,
    variant?: ToastVariant,
    options?: ToastOptions,
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
      options?: ToastOptions,
    ) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const placement = options?.placement ?? "bottom";
      const stack = options?.stack ?? placement !== "top";
      setItems((prev) => {
        let kept = prev;
        if (placement === "top" && !stack) {
          kept = prev.filter((item) => item.placement !== "top");
        } else if (options?.href) {
          kept = prev.filter((item) => item.href !== options.href);
        }
        return [
          ...kept,
          {
            id,
            message,
            variant,
            placement,
            title: options?.title,
            href: options?.href,
            actionLabel: options?.actionLabel,
          },
        ].slice(-4);
      });
      window.setTimeout(() => dismiss(id), placement === "top" ? 7000 : 3500);
    },
    [dismiss],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setItems((prev) => {
        const top = [...prev].reverse().find((item) => item.placement === "top");
        if (!top) return prev;
        return prev.filter((item) => item.id !== top.id);
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            className="pointer-events-none fixed top-4 right-4 z-[110] flex w-[min(100%-2rem,18rem)] flex-col items-end gap-1.5"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
            suppressHydrationWarning
          >
            {topItems.map((item) => (
              <div
                key={item.id}
                role="status"
                className="pointer-events-auto w-full overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card)"
              >
                <div className="flex items-start gap-2 px-2.5 py-2">
                  <span className="mt-0.5 size-2 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {item.title ?? "Update"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-foreground">
                      {item.message}
                    </p>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => dismiss(item.id)}
                        className="mt-1 inline-flex text-[12px] font-semibold text-accent hover:text-accent-hover"
                      >
                        {item.actionLabel ?? "Open"}
                      </Link>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="shrink-0 rounded px-1 text-sm leading-none text-muted hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
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
