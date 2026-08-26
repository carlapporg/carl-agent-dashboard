import { proxyTaskMediaUpload } from "@/lib/api/task-media-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  return proxyTaskMediaUpload(taskId, "image", request);
}
