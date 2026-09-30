import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { proxyTaskMediaGet } from "@/lib/api/task-media-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { conversationId, messageId } = await context.params;
  return proxyTaskMediaGet(
    API_ENDPOINTS.agents.adminChatMessageFileGet(conversationId, messageId),
    "application/octet-stream",
  );
}
