import type { Metadata } from "next";
import { MessagesPageClient } from "@/features/messages/components/messages-page-client";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "Chat Box",
};

export default function MessagesPage() {
  return (
    <PageShell wide className="max-w-none">
      <MessagesPageClient />
    </PageShell>
  );
}
