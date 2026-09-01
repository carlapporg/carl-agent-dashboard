import type { Metadata } from "next";
import { AdminChatView } from "@/features/admin-chat/components/admin-chat-view";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { adminChatsApi } from "@/lib/api/admin-chats";

export const metadata: Metadata = {
  title: "Admin chat",
};

export default async function AdminChatPage() {
  let conversations: Awaited<ReturnType<typeof adminChatsApi.list>> = [];
  let loadFailed = false;

  try {
    conversations = await adminChatsApi.list();
  } catch {
    loadFailed = true;
  }

  return (
    <PageShell wide>
      {loadFailed ? (
        <EmptyState
          title="Can't reach the server"
          description="Your login is still saved. The API tunnel may be down. Wait a moment and refresh."
        />
      ) : (
        <AdminChatView initialConversations={conversations} />
      )}
    </PageShell>
  );
}
