"use client";

import type { ReactNode } from "react";
import { CallProvider } from "@/features/calls/call-provider";
import { AgentOpsProvider } from "@/features/ops/ops-provider";
import { OfferToast } from "@/features/ops/offer-toast";
import type { AgentPresence } from "@/types/agent";

type AgentSocketProviderProps = {
  children: ReactNode;
  socketUrl: string;
  accessToken: string;
  openTaskId?: string;
  initialPresence?: AgentPresence;
};

export function AgentSocketProvider({
  children,
  socketUrl,
  accessToken,
  openTaskId,
  initialPresence,
}: AgentSocketProviderProps) {
  return (
    <AgentOpsProvider
      socketUrl={socketUrl}
      accessToken={accessToken}
      openTaskId={openTaskId}
      initialPresence={initialPresence}
    >
      <CallProvider>
        <OfferToast />
        {children}
      </CallProvider>
    </AgentOpsProvider>
  );
}
