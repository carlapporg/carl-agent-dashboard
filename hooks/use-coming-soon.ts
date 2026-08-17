"use client";

import { useToast } from "@/components/providers/toast-provider";

export function useComingSoon() {
  const { comingSoon } = useToast();
  return comingSoon;
}
