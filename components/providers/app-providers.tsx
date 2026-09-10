"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { createQueryClient } from "@/lib/query/client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
