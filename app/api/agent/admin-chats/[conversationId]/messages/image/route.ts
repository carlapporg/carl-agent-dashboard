import { NextResponse } from "next/server";
import { adminChatsApi } from "@/lib/api/admin-chats";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import { ADMIN_CHAT_MEDIA, isAdminChatImage } from "@/lib/api/admin-chat-media";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: "Choose a photo first." }, { status: 400 });
    }
    if (!isAdminChatImage(file)) {
      return NextResponse.json(
        { message: "Use a jpeg, png, webp, gif, or heic photo." },
        { status: 400 },
      );
    }
    if (file.size > ADMIN_CHAT_MEDIA.maxImageBytes) {
      return NextResponse.json(
        { message: "Photos must be 10 MB or smaller." },
        { status: 400 },
      );
    }
    const message = await adminChatsApi.sendAttachment(conversationId, "image", form);
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    const status = isApiError(error) ? error.status || 502 : 502;
    return NextResponse.json({ message: toUserMessage(error) }, { status });
  }
}
