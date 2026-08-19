"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/providers/toast-provider";
import { createQueryClient } from "@/lib/query/client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </ToastProvider>
    </QueryClientProvider>
  );
}
