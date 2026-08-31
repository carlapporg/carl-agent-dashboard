import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { proxyTaskMediaGet } from "@/lib/api/task-media-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string; receiptId: string }> },
) {
  const { taskId, receiptId } = await context.params;
  return proxyTaskMediaGet(
    API_ENDPOINTS.agents.taskReceiptFile(taskId, receiptId),
    "application/octet-stream",
  );
}
