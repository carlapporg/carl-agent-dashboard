"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getCallRecordingAction,
  getCallTranscriptAction,
} from "@/features/calls/actions";
import { callIdFromMessageMetadata } from "@/types/call";

type LoadedTranscript = {
  text: string | null;
  summary: string | null;
  status: string | null;
};

type CallTranscriptCardProps = {
  metadata: unknown;
  createdAt: string;
  title?: string;
};

type Phase = "idle" | "loading" | "making" | "ready" | "error";

function clockLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function accessMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Can't open this right now.";
}

function cardHeading(title?: string): string {
  const cleaned = (title ?? "")
    .replace(/\s*·\s*view transcript\s*/gi, "")
    .trim();
  return cleaned || "Call";
}

function metaStatus(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const status = (metadata as { transcriptStatus?: unknown }).transcriptStatus;
  return typeof status === "string" ? status : null;
}

function isMaking(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

function Spinner() {
  return (
    <span
      className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

export function CallTranscriptCard({
  metadata,
  createdAt,
  title,
}: CallTranscriptCardProps) {
  const callId = callIdFromMessageMetadata(metadata);
  const hintedStatus = metaStatus(metadata);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(
    isMaking(hintedStatus) ? "making" : "idle",
  );
  const [transcript, setTranscript] = useState<LoadedTranscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playHidden, setPlayHidden] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const status = transcript?.status ?? hintedStatus;
  const making = phase === "making" || (phase === "idle" && isMaking(status));

  useEffect(() => {
    if (!callId) return;
    if (!open && !isMaking(hintedStatus) && !isMaking(transcript?.status)) {
      return;
    }
    let cancelled = false;
    let timer = 0;

    async function tick() {
      try {
        const result = await getCallTranscriptAction(callId!);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.message);
          setPhase("error");
          return;
        }
        setTranscript(result.data);
        setError(null);
        if (isMaking(result.data.status)) {
          setPhase("making");
          timer = window.setTimeout(() => void tick(), 4000);
          return;
        }
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setError(accessMessage(err));
        setPhase("error");
      }
    }

    if (!transcript && phase !== "making") setPhase("loading");
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Poll while this card is open, or while the server is still writing the transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, open, hintedStatus]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audioUrl) return;
    const onError = () => {
      setPlayError("The recording file did not load.");
    };
    node.addEventListener("error", onError);
    return () => node.removeEventListener("error", onError);
  }, [audioUrl]);

  async function playRecording() {
    if (!callId || playHidden || audioUrl) return;
    setPlayLoading(true);
    setPlayError(null);
    try {
      const result = await getCallRecordingAction(callId);
      if (!result.ok) {
        if (result.missing) {
          setPlayHidden(true);
          return;
        }
        setPlayError(result.message);
        return;
      }
      const node = audioRef.current;
      if (node) {
        node.src = result.url;
        node.load();
      }
      setAudioUrl(result.url);
      try {
        await node?.play();
      } catch {
        setPlayError("Press the play triangle on the gray bar.");
      }
    } catch (err) {
      setPlayError(accessMessage(err));
    } finally {
      setPlayLoading(false);
    }
  }

  const summaryText = transcript?.summary?.trim() || "";
  const transcriptText = transcript?.text?.trim() || "";
  const time = clockLabel(createdAt);
  const showPlay =
    phase === "ready" && status !== "unavailable" && !playHidden && !audioUrl;

  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
            <path d="M6.5 3.2a1.2 1.2 0 0 0-1.4.7L4.2 6.2a1.2 1.2 0 0 0 .3 1.3l1.5 1.2a9.4 9.4 0 0 0 5.3 5.3l1.2-1.5a1.2 1.2 0 0 1 1.3-.3l2.3.9a1.2 1.2 0 0 1 .7 1.4l-.6 2.1a1.2 1.2 0 0 1-1.2.8A13.3 13.3 0 0 1 2.3 4.9a1.2 1.2 0 0 1 .8-1.2l2.1-.6a1.2 1.2 0 0 1 1.3.1Z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
            {cardHeading(title)}
          </span>
          {making ? (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Spinner />
              Making transcript…
            </span>
          ) : time ? (
            <span className="mt-0.5 block text-[11px] leading-4 text-muted">
              {time}
            </span>
          ) : null}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-border px-2.5 py-2">
          {phase === "loading" ? (
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <Spinner />
              Loading transcript…
            </p>
          ) : null}
          {phase === "making" ? (
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <Spinner />
              Transcript is being made.
            </p>
          ) : null}
          {phase === "error" && error ? (
            <p className="text-[12px] text-muted">{error}</p>
          ) : null}
          {phase === "ready" && status === "failed" ? (
            <p className="text-[12px] text-muted">Transcript could not be made.</p>
          ) : null}
          {phase === "ready" && status === "unavailable" ? (
            <p className="text-[12px] text-muted">No recording was saved for this call.</p>
          ) : null}
          {phase === "ready" && summaryText ? (
            <p className="text-[12px] leading-snug text-foreground">{summaryText}</p>
          ) : null}
          {phase === "ready" && transcriptText ? (
            <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12px] leading-snug text-foreground">
              {transcriptText}
            </p>
          ) : null}
          {phase === "ready" &&
          status !== "failed" &&
          status !== "unavailable" &&
          !summaryText &&
          !transcriptText ? (
            <p className="text-[12px] text-muted">No transcript text yet.</p>
          ) : null}

          {showPlay ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-2 h-7 px-2.5 text-[11px]"
              loading={playLoading}
              onClick={() => void playRecording()}
            >
              Play
            </Button>
          ) : null}
          {playError ? (
            <p className="mt-1.5 text-[11px] text-muted">{playError}</p>
          ) : null}
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            className={audioUrl ? "mt-2 h-8 w-full" : "hidden"}
          />
        </div>
      ) : null}
    </div>
  );
}
