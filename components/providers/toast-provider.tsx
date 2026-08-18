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
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
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
    (message: string, variant: ToastVariant = "info") => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev, { id, message, variant }].slice(-4));
      window.setTimeout(() => dismiss(id), 3500);
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

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
          suppressHydrationWarning
        >
          {items.map((item) => (
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
