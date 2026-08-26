import { NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import { messagesApi } from "@/lib/api/messages";

function jsonError(error: unknown) {
  const status = isApiError(error) ? error.status || 502 : 502;
  return NextResponse.json({ message: toUserMessage(error) }, { status });
}

export async function proxyTaskMediaUpload(
  taskId: string,
  kind: "voice" | "image",
  request: Request,
): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { message: kind === "voice" ? "Record a voice note first." : "Choose an image first." },
        { status: 400 },
      );
    }
    const event =
      kind === "voice"
        ? await messagesApi.sendVoice(taskId, form)
        : await messagesApi.sendImage(taskId, form);
    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function proxyTaskMediaGet(
  path: string,
  fallbackType: string,
): Promise<Response> {
  try {
    const upstream = await nestFetch(path, { timeoutMs: 60_000 });
    if (!upstream.ok) {
      let message = "Couldn't load this file.";
      try {
        const raw: unknown = await upstream.json();
        if (raw && typeof raw === "object" && "message" in raw) {
          const value = (raw as { message: unknown }).message;
          if (typeof value === "string" && value.trim()) message = value;
        }
      } catch {
        /* ignore non-json error bodies */
      }
      return NextResponse.json({ message }, { status: upstream.status });
    }
    const contentType = upstream.headers.get("content-type") || fallbackType;
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
