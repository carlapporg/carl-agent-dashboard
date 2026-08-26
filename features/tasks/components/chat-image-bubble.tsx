"use client";

import { useEffect, useState } from "react";
import { dashboardImageSrc } from "@/lib/api/task-media";
import { cn } from "@/lib/utils/cn";

type ChatImageBubbleProps = {
  taskId: string;
  messageId: string;
  previewUrl?: string | null;
  caption?: string;
  fromAgent: boolean;
  onOpen: (src: string) => void;
};

export function ChatImageBubble({
  taskId,
  messageId,
  previewUrl,
  caption,
  fromAgent,
  onOpen,
}: ChatImageBubbleProps) {
  const [retryAt, setRetryAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(previewUrl));
  const src =
    retryAt > 0
      ? `${dashboardImageSrc(taskId, messageId)}?retry=${retryAt}`
      : previewUrl || dashboardImageSrc(taskId, messageId);

  return (
    <div className="min-w-0">
      {failed ? (
        <div
          className={cn(
            "flex h-32 w-48 items-center justify-center rounded-xl text-[12px]",
            fromAgent ? "bg-white/15 text-white/80" : "bg-black/5 text-muted",
          )}
        >
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setRetryAt(Date.now());
            }}
          >
            Couldn’t load · Retry
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(src)}
          className="block overflow-hidden rounded-xl text-left"
          aria-label="View image larger"
        >
          {!loaded ? (
            <div
              className={cn(
                "h-32 w-48 animate-pulse rounded-xl",
                fromAgent ? "bg-white/20" : "bg-black/10",
              )}
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={caption || "Image attachment"}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              "max-h-56 max-w-full object-cover",
              loaded ? "block" : "hidden",
            )}
          />
        </button>
      )}
      {caption ? (
        <p className="mt-1 whitespace-pre-wrap wrap-break-word">{caption}</p>
      ) : null}
    </div>
  );
}

export function ChatImageLightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close image preview"
        onClick={onClose}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full size attachment"
        className="relative z-10 max-h-[90vh] max-w-[min(92vw,56rem)] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
