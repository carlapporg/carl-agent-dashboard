"use client";

import { useEffect, useRef, useState } from "react";
import { dashboardAudioSrc, formatClockMs } from "@/lib/api/task-media";
import { cn } from "@/lib/utils/cn";

type ChatAudioPlayerProps = {
  taskId: string;
  messageId: string;
  durationMs?: number | null;
  previewUrl?: string | null;
  fromAgent: boolean;
  /**
   * - `workspace` — task workspace player
   * - `inbox` — Figma Chat Box voice bubble (waveform)
   * - `inbox-preview` — Figma composer preview (blue play + seek)
   */
  appearance?: "workspace" | "inbox" | "inbox-preview";
};

const BAR_COUNT = 28;
const MAX_BAR_H = 24;
const QUIET_LINE_H = 2;
const peakCache = new Map<string, number[]>();

let activeAudio: HTMLAudioElement | null = null;
let sharedAudioCtx: AudioContext | null = null;

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8.4 5.6v12.8L19 12 8.4 5.6Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M7 6h3.2v12H7V6Zm6.8 0H17v12h-3.2V6Z" />
    </svg>
  );
}

function formatInboxDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getAudioContext(): AudioContext {
  if (sharedAudioCtx && sharedAudioCtx.state !== "closed") return sharedAudioCtx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  sharedAudioCtx = new Ctx();
  return sharedAudioCtx;
}

/** Decode audio and map amplitude → bar heights (0 = quiet line). */
async function extractPeaksFromUrl(
  url: string,
  barCount: number,
): Promise<number[]> {
  const cached = peakCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) throw new Error("audio fetch failed");
  const raw = await response.arrayBuffer();
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  const audio = await ctx.decodeAudioData(raw.slice(0));
  const channel = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(channel.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    const start = i * block;
    const end = Math.min(channel.length, start + block);
    let sumSq = 0;
    let peak = 0;
    const samples = Math.max(1, end - start);
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(channel[j] ?? 0);
      peak = Math.max(peak, v);
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / samples);
    const level = Math.max(peak * 0.65, rms * 1.8);
    if (level < 0.02) {
      peaks.push(0);
    } else {
      peaks.push(
        Math.min(MAX_BAR_H, Math.max(4, Math.round(2 + level * (MAX_BAR_H - 2)))),
      );
    }
  }

  peakCache.set(url, peaks);
  return peaks;
}

type WaveSegment =
  | { type: "bar"; height: number }
  | { type: "line"; span: number };

function buildWaveSegments(bars: ReadonlyArray<number>): WaveSegment[] {
  const segments: WaveSegment[] = [];
  let quietRun = 0;

  function flushQuiet() {
    if (quietRun <= 0) return;
    segments.push({ type: "line", span: quietRun });
    quietRun = 0;
  }

  for (const height of bars) {
    if (height <= 0) {
      quietRun += 1;
      continue;
    }
    flushQuiet();
    segments.push({ type: "bar", height });
  }
  flushQuiet();
  return segments;
}

/** Flat placeholder while peaks load. */
const LOADING_PEAKS = Array.from({ length: BAR_COUNT }, () => 0);

export function ChatAudioPlayer({
  taskId,
  messageId,
  durationMs,
  previewUrl,
  fromAgent,
  appearance = "workspace",
}: ChatAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maskRef = useRef<HTMLDivElement | null>(null);
  const clockRef = useRef<HTMLParagraphElement | null>(null);
  const lastClockRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [knownMs, setKnownMs] = useState(durationMs ?? 0);
  const [broken, setBroken] = useState(false);
  const [peaks, setPeaks] = useState<number[]>(LOADING_PEAKS);
  const src = previewUrl || dashboardAudioSrc(taskId, messageId);
  const total = knownMs > 0 ? knownMs : durationMs ?? 0;
  const progress = total > 0 ? Math.min(100, (currentMs / total) * 100) : 0;
  const inboxBubble = appearance === "inbox";
  const inboxPreview = appearance === "inbox-preview";
  const displayMs = playing || currentMs > 0 ? currentMs : total;
  const segments = buildWaveSegments(peaks);

  useEffect(() => {
    setKnownMs(durationMs ?? 0);
    setCurrentMs(0);
    setPlaying(false);
    setBroken(false);
    lastClockRef.current = 0;
    if (maskRef.current) maskRef.current.style.width = "0%";
  }, [durationMs, previewUrl, messageId]);

  useEffect(() => {
    if (!inboxBubble) return;
    let cancelled = false;
    setPeaks(LOADING_PEAKS);
    void extractPeaksFromUrl(src, BAR_COUNT)
      .then((next) => {
        if (!cancelled) setPeaks(next);
      })
      .catch(() => {
        if (!cancelled) setPeaks(LOADING_PEAKS);
      });
    return () => {
      cancelled = true;
    };
  }, [inboxBubble, src]);

  useEffect(() => {
    const node = audioRef.current;
    return () => {
      if (activeAudio === node) activeAudio = null;
    };
  }, []);

  function syncProgressUi(ms: number, forceClock = false) {
    const pct = total > 0 ? Math.min(100, (ms / total) * 100) : 0;
    if (maskRef.current) {
      maskRef.current.style.width = `${Math.max(0, 100 - pct)}%`;
    }
    if (!inboxBubble) {
      setCurrentMs(ms);
      return;
    }
    const now = performance.now();
    if (forceClock || now - lastClockRef.current > 200) {
      lastClockRef.current = now;
      setCurrentMs(ms);
      if (clockRef.current && !broken) {
        clockRef.current.textContent = formatInboxDuration(
          ms > 0 || playing ? ms : total,
        );
      }
    }
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || broken) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    void audio.play().catch(() => setBroken(true));
  }

  function seekToRatio(ratio: number) {
    const audio = audioRef.current;
    if (!audio || total <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * (total / 1000);
    audio.currentTime = next;
    syncProgressUi(next * 1000, true);
  }

  const audioEl = (
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        syncProgressUi(0, true);
      }}
      onTimeUpdate={(event) => {
        syncProgressUi(event.currentTarget.currentTime * 1000);
      }}
      onLoadedMetadata={(event) => {
        const ms = event.currentTarget.duration * 1000;
        if (Number.isFinite(ms) && ms > 0) setKnownMs(ms);
      }}
      onError={() => setBroken(true)}
    />
  );

  if (inboxBubble) {
    return (
      <div className="flex w-full items-center gap-3">
        {audioEl}
        <button
          type="button"
          onClick={toggle}
          disabled={broken}
          aria-label={playing ? "Pause voice message" : "Play voice message"}
          className={cn(
            "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[16px] text-accent",
            broken && "opacity-50",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/messages/icon-play.svg"
            alt=""
            width={16}
            height={16}
            className="absolute inset-0 m-auto size-4"
          />
          {playing ? (
            <PauseIcon className="relative z-10 size-2.5" />
          ) : (
            <PlayIcon className="relative z-10 ml-0.5 size-2.5" />
          )}
        </button>

        <div
          className="relative flex h-6 min-w-0 flex-1 cursor-pointer items-center"
          role="slider"
          aria-label="Voice message progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          tabIndex={broken ? -1 : 0}
          onClick={(event) => {
            if (broken || total <= 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            seekToRatio((event.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(event) => {
            if (broken || total <= 0) return;
            if (event.key === "ArrowRight") {
              event.preventDefault();
              seekToRatio((progress + 5) / 100);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              seekToRatio((progress - 5) / 100);
            }
          }}
        >
          <div className="flex w-full items-center gap-[3px]">
            {segments.map((segment, index) =>
              segment.type === "line" ? (
                <span
                  key={`line-${index}`}
                  className="shrink-0 rounded-full bg-accent"
                  style={{
                    width: segment.span * 3 + Math.max(0, segment.span - 1) * 3,
                    height: QUIET_LINE_H,
                  }}
                  aria-hidden
                />
              ) : (
                <span
                  key={`bar-${index}`}
                  className="w-[3px] shrink-0 rounded-[1.5px] bg-accent"
                  style={{ height: segment.height }}
                  aria-hidden
                />
              ),
            )}
          </div>
          <div
            ref={maskRef}
            className="pointer-events-none absolute inset-y-0 right-0 bg-surface-muted/75"
            style={{
              width: playing || currentMs > 0 ? `${100 - progress}%` : "0%",
            }}
            aria-hidden
          />
        </div>

        <p
          ref={clockRef}
          className="shrink-0 text-[12px] font-medium tabular-nums text-foreground"
        >
          {broken ? "—" : formatInboxDuration(displayMs > 0 ? displayMs : total)}
        </p>
      </div>
    );
  }

  if (inboxPreview) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {audioEl}
        <button
          type="button"
          onClick={toggle}
          disabled={broken}
          aria-label={playing ? "Pause voice message" : "Play voice message"}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover",
            broken && "opacity-50",
          )}
        >
          {playing ? (
            <PauseIcon className="size-3.5" />
          ) : (
            <PlayIcon className="ml-0.5 size-3.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={progress}
            aria-label="Voice message progress"
            onChange={(event) => {
              seekToRatio(Number(event.target.value) / 100);
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-[#377dff]"
          />
          <p className="mt-1 text-[11px] tabular-nums text-[rgba(0,0,0,0.45)]">
            {broken
              ? "Can't play this note"
              : `${formatClockMs(currentMs)} / ${formatClockMs(total)}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-48 items-center gap-2 py-0.5",
        fromAgent ? "text-accent-foreground" : "text-foreground",
      )}
    >
      {audioEl}
      <button
        type="button"
        onClick={toggle}
        disabled={broken}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          fromAgent
            ? "bg-white/20 hover:bg-white/30"
            : "bg-accent text-accent-foreground hover:bg-accent-hover",
          broken && "opacity-50",
        )}
      >
        {playing ? (
          <PauseIcon className="size-3.5" />
        ) : (
          <PlayIcon className="ml-0.5 size-3.5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={progress}
          aria-label="Voice message progress"
          onChange={(event) => {
            seekToRatio(Number(event.target.value) / 100);
          }}
          className={cn(
            "h-1 w-full cursor-pointer appearance-none rounded-full",
            fromAgent ? "accent-white bg-white/30" : "accent-accent bg-black/10",
          )}
        />
        <p
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            fromAgent ? "text-white/80" : "text-muted",
          )}
        >
          {broken
            ? "Can't play this note"
            : `${formatClockMs(currentMs)} / ${formatClockMs(total)}`}
        </p>
      </div>
    </div>
  );
}
