import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { proxyTaskMediaGet } from "@/lib/api/task-media-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string; messageId: string }> },
) {
  const { taskId, messageId } = await context.params;
  return proxyTaskMediaGet(
    API_ENDPOINTS.agents.taskMessageAudio(taskId, messageId),
    "audio/webm",
  );
}
