/**
 * Incoming call ringtone. Uses a looping telephone WAV; falls back to Web Audio.
 */

const RINGTONE_SRC = "/sounds/incoming-ring.wav";

let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let loopTimer: number | null = null;
let playing = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playBurst(ctx: AudioContext) {
  const t = ctx.currentTime;
  tone(ctx, 440, t, 1.8, 0.09);
  tone(ctx, 480, t, 1.8, 0.09);
}

function ensureRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    return ctx.resume().then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

function stopFallback() {
  if (loopTimer != null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
}

function startFallback() {
  const ctx = getContext();
  if (!ctx) return;
  void ensureRunning(ctx).then(() => {
    if (!playing) return;
    playBurst(ctx);
    stopFallback();
    loopTimer = window.setInterval(() => {
      if (!playing) return;
      void ensureRunning(ctx).then(() => {
        if (playing) playBurst(ctx);
      });
    }, 5000);
  });
}

function stopFile() {
  if (!audioEl) return;
  audioEl.pause();
  audioEl.currentTime = 0;
  audioEl.src = "";
  audioEl = null;
}

export function startIncomingRingtone() {
  if (typeof window === "undefined") return;
  if (playing) return;
  playing = true;

  const el = new Audio(RINGTONE_SRC);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0.85;
  audioEl = el;

  void el.play().then(() => {
    stopFallback();
  }).catch(() => {
    stopFile();
    if (playing) startFallback();
  });
}

export function stopIncomingRingtone() {
  playing = false;
  stopFile();
  stopFallback();
}

export function isIncomingRingtonePlaying() {
  return playing;
}
