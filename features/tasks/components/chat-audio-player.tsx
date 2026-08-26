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
};

let activeAudio: HTMLAudioElement | null = null;

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

export function ChatAudioPlayer({
  taskId,
  messageId,
  durationMs,
  previewUrl,
  fromAgent,
}: ChatAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [knownMs, setKnownMs] = useState(durationMs ?? 0);
  const [broken, setBroken] = useState(false);
  const src = previewUrl || dashboardAudioSrc(taskId, messageId);
  const total = knownMs > 0 ? knownMs : durationMs ?? 0;
  const progress = total > 0 ? Math.min(100, (currentMs / total) * 100) : 0;

  useEffect(() => {
    const node = audioRef.current;
    return () => {
      if (activeAudio === node) activeAudio = null;
    };
  }, []);

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

  return (
    <div
      className={cn(
        "flex min-w-48 items-center gap-2 py-0.5",
        fromAgent ? "text-accent-foreground" : "text-foreground",
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentMs(0);
        }}
        onTimeUpdate={(event) => {
          setCurrentMs(event.currentTarget.currentTime * 1000);
        }}
        onLoadedMetadata={(event) => {
          const ms = event.currentTarget.duration * 1000;
          if (Number.isFinite(ms) && ms > 0) setKnownMs(ms);
        }}
        onError={() => setBroken(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={broken}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          fromAgent ? "bg-white/20 hover:bg-white/30" : "bg-accent text-accent-foreground hover:bg-accent-hover",
          broken && "opacity-50",
        )}
      >
        {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="ml-0.5 size-3.5" />}
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
            const audio = audioRef.current;
            if (!audio || total <= 0) return;
            const next = (Number(event.target.value) / 100) * (total / 1000);
            audio.currentTime = next;
            setCurrentMs(next * 1000);
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
