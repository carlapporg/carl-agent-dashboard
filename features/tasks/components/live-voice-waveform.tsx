"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils/cn";

type LiveVoiceWaveformProps = {
  active: boolean;
  streamRef: RefObject<MediaStream | null>;
  className?: string;
  /** Visual bar count inside the existing recorder slot. */
  barCount?: number;
  /** Max bar height in px (clamped to design). */
  maxHeight?: number;
};

const BAR_W = 3;
const BAR_GAP = 3;
const SILENCE_FLOOR = 0.045;

function levelToHeight(level: number, maxHeight: number): number {
  // Map amplitude → designed heights (prompt scale)
  if (level < 0.05) return 2;
  if (level < 0.1) return 4;
  if (level < 0.2) return 6;
  if (level < 0.3) return 10;
  if (level < 0.5) return 14;
  if (level < 0.6) return 18;
  if (level < 0.8) return 24;
  return maxHeight;
}

/**
 * Mic-driven live waveform for the voice recorder.
 * Draws on canvas via rAF — no per-frame React state.
 */
export function LiveVoiceWaveform({
  active,
  streamRef,
  className,
  barCount = 48,
  maxHeight = 24,
}: LiveVoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothedRef = useRef(0);
  const barLevelsRef = useRef<Float32Array>(new Float32Array(barCount));

  useEffect(() => {
    if (!active) return;

    const stream = streamRef.current;
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;

    let cancelled = false;
    const data = new Uint8Array(2048);

    async function start() {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
      if (cancelled) {
        void ctx.close();
        return;
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream!);
      sourceRef.current = source;
      source.connect(analyser);

      const bars = barLevelsRef.current;
      for (let i = 0; i < bars.length; i += 1) bars[i] = 0;

      const draw = () => {
        if (cancelled) return;
        const node = analyserRef.current;
        const surface = canvasRef.current;
        if (!node || !surface) return;

        node.getByteTimeDomainData(data);

        // RMS amplitude from time-domain samples (0..1)
        let sumSq = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i]! - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        // Noise gate + gentle boost into usable range
        const gated = rms < SILENCE_FLOOR ? rms * 0.35 : Math.min(1, rms * 3.2);
        smoothedRef.current = smoothedRef.current * 0.85 + gated * 0.15;
        const level = smoothedRef.current;

        // Per-bar variation from nearby samples (natural peaks, not identical)
        const step = Math.floor(data.length / bars.length);
        const t = performance.now() / 1000;
        for (let i = 0; i < bars.length; i += 1) {
          const sample = data[i * step] ?? 128;
          const local = Math.abs((sample - 128) / 128);
          const mixed = level * 0.72 + local * level * 0.55;
          let target = levelToHeight(mixed, maxHeight);
          if (level < SILENCE_FLOOR) {
            // Almost flat + tiny idle shimmer
            target = 2 + Math.sin(t * 2.2 + i * 0.45) * 0.6;
          }
          const prev = bars[i] ?? 2;
          bars[i] = prev * 0.72 + target * 0.28;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = surface.clientWidth || 1;
        const cssH = surface.clientHeight || maxHeight;
        const pixelW = Math.floor(cssW * dpr);
        const pixelH = Math.floor(cssH * dpr);
        if (surface.width !== pixelW || surface.height !== pixelH) {
          surface.width = pixelW;
          surface.height = pixelH;
        }

        const ctx2d = surface.getContext("2d");
        if (!ctx2d) {
          rafRef.current = window.requestAnimationFrame(draw);
          return;
        }

        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2d.clearRect(0, 0, cssW, cssH);

        const totalBarW = bars.length * BAR_W + (bars.length - 1) * BAR_GAP;
        const startX = Math.max(0, (cssW - totalBarW) / 2);
        const midY = cssH / 2;

        ctx2d.fillStyle = "#377dff";
        for (let i = 0; i < bars.length; i += 1) {
          const h = Math.min(maxHeight, Math.max(2, bars[i] ?? 2));
          const x = startX + i * (BAR_W + BAR_GAP);
          const y = midY - h / 2;
          const r = 1.5;
          // Rounded caps
          ctx2d.beginPath();
          ctx2d.moveTo(x + r, y);
          ctx2d.arcTo(x + BAR_W, y, x + BAR_W, y + h, r);
          ctx2d.arcTo(x + BAR_W, y + h, x, y + h, r);
          ctx2d.arcTo(x, y + h, x, y, r);
          ctx2d.arcTo(x, y, x + BAR_W, y, r);
          ctx2d.closePath();
          ctx2d.fill();
        }

        rafRef.current = window.requestAnimationFrame(draw);
      };

      rafRef.current = window.requestAnimationFrame(draw);
    }

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx) {
        void ctx.close().catch(() => undefined);
      }
      smoothedRef.current = 0;
    };
  }, [active, barCount, maxHeight, streamRef]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("h-6 w-full min-w-0", className)}
      aria-hidden
    />
  );
}
