"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  getCallRecordingAction,
  getCallTranscriptAction,
} from "@/features/calls/actions";
import {
  callIdFromMessageMetadata,
  metadataFlag,
} from "@/types/call";

type LoadedTranscript = { text: string | null; summary: string | null };

type CallTranscriptCardProps = {
  metadata: unknown;
  createdAt: string;
  title?: string;
};

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

export function CallTranscriptCard({
  metadata,
  createdAt,
  title,
}: CallTranscriptCardProps) {
  const callId = callIdFromMessageMetadata(metadata);
  const canViewTranscript =
    metadataFlag(metadata, "canViewTranscript") ||
    metadataFlag(metadata, "openTranscript");
  const canViewSummary =
    metadataFlag(metadata, "canViewSummary") || canViewTranscript;
  const canPlayRecording =
    metadataFlag(metadata, "canPlayRecording") || canViewTranscript;

  const [transcript, setTranscript] = useState<LoadedTranscript | null>(null);
  const [summaryState, setSummaryState] = useState<
    "idle" | "loading" | "ready" | "error"
  >(canViewSummary ? "loading" : "idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [playHidden, setPlayHidden] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedRef = useRef<Promise<LoadedTranscript> | null>(null);

  function loadTranscript(): Promise<LoadedTranscript> {
    if (!callId) return Promise.reject(new Error("Missing call"));
    if (transcript) return Promise.resolve(transcript);
    if (!loadedRef.current) {
      loadedRef.current = getCallTranscriptAction(callId).then((result) => {
        if (!result.ok) {
          loadedRef.current = null;
          throw new Error(result.message);
        }
        setTranscript(result.data);
        return result.data;
      });
    }
    return loadedRef.current;
  }

  useEffect(() => {
    if (!canViewSummary || !callId) return;
    let cancelled = false;
    loadTranscript()
      .then(() => {
        if (!cancelled) setSummaryState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        loadedRef.current = null;
        setSummaryError(accessMessage(error));
        setSummaryState("error");
      });
    return () => {
      cancelled = true;
    };
    // Summary loads once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, canViewSummary]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audioUrl) return;
    const onError = () => {
      setPlayError("The recording file did not load.");
    };
    node.addEventListener("error", onError);
    return () => node.removeEventListener("error", onError);
  }, [audioUrl]);

  async function openTranscript() {
    setTranscriptOpen(true);
    setTranscriptError(null);
    if (transcript) return;
    setTranscriptLoading(true);
    try {
      await loadTranscript();
    } catch (error) {
      loadedRef.current = null;
      setTranscriptError(accessMessage(error));
    } finally {
      setTranscriptLoading(false);
    }
  }

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
    } catch (error) {
      setPlayError(accessMessage(error));
    } finally {
      setPlayLoading(false);
    }
  }

  const summaryText = transcript?.summary?.trim() || "";
  const showPlay = canPlayRecording && !playHidden && !audioUrl;
  const time = clockLabel(createdAt);

  return (
    <div className="mx-auto w-full max-w-88 rounded-[15px] border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Call
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {cardHeading(title)}
      </p>

      {canViewSummary && summaryState === "loading" ? (
        <p className="mt-2 text-[12px] text-muted">Loading summary…</p>
      ) : null}
      {canViewSummary && summaryState === "ready" && summaryText ? (
        <p className="mt-2 text-[13px] leading-snug text-foreground">
          {summaryText}
        </p>
      ) : null}
      {canViewSummary && summaryState === "error" && summaryError ? (
        <p className="mt-2 text-[12px] text-muted">{summaryError}</p>
      ) : null}

      {showPlay || canViewTranscript ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {canViewTranscript ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-[12px]"
              onClick={() => void openTranscript()}
            >
              View transcript
            </Button>
          ) : null}
          {showPlay ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-[12px]"
              loading={playLoading}
              onClick={() => void playRecording()}
            >
              Play
            </Button>
          ) : null}
        </div>
      ) : null}

      {playError ? (
        <p className="mt-2 text-[12px] text-muted">{playError}</p>
      ) : null}

      <audio
        ref={audioRef}
        controls
        preload="metadata"
        className={audioUrl ? "mt-2 w-full" : "hidden"}
      />

      {time ? <p className="mt-1.5 text-[10px] text-muted">{time}</p> : null}

      <Dialog
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        title="Transcript"
        className="max-w-lg"
      >
        {transcriptLoading ? (
          <p className="text-sm text-muted">Loading transcript…</p>
        ) : transcriptError ? (
          <p className="text-sm text-muted">{transcriptError}</p>
        ) : (
          <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {transcript?.text?.trim() || "No transcript text yet."}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTranscriptOpen(false)}
          >
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
