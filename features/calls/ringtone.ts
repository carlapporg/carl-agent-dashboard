/**
 * Incoming call ringtone (Web Audio). Loops until stopIncomingRingtone().
 */

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

/** One classic dual-tone ring burst (~1.2s). */
function playBurst(ctx: AudioContext) {
  const t = ctx.currentTime;
  // US-style ring: 440 + 480 Hz together
  tone(ctx, 440, t, 0.9, 0.07);
  tone(ctx, 480, t, 0.9, 0.07);
}

function ensureRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    return ctx.resume().then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

export function startIncomingRingtone() {
  if (typeof window === "undefined") return;
  if (playing) return;
  const ctx = getContext();
  if (!ctx) return;
  playing = true;

  void ensureRunning(ctx).then(() => {
    if (!playing) return;
    playBurst(ctx);
    loopTimer = window.setInterval(() => {
      if (!playing) return;
      void ensureRunning(ctx).then(() => {
        if (playing) playBurst(ctx);
      });
    }, 2200);
  });
}

export function stopIncomingRingtone() {
  playing = false;
  if (loopTimer != null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function isIncomingRingtonePlaying() {
  return playing;
}
