let unlocked = false;
let lastPlayedAt = 0;
let chimeEl: HTMLAudioElement | null = null;
let chimeUri: string | null = null;
let audioCtx: AudioContext | null = null;

function buildChimeUri(): string {
  const sampleRate = 22050;
  const length = Math.ceil(sampleRate * 0.32);
  const samples = new Int16Array(length);
  const notes = [
    { freq: 880, start: 0, dur: 0.1 },
    { freq: 1175, start: 0.11, dur: 0.18 },
  ];
  for (const note of notes) {
    const start = Math.floor(note.start * sampleRate);
    const count = Math.floor(note.dur * sampleRate);
    for (let i = 0; i < count; i += 1) {
      const idx = start + i;
      if (idx >= length) break;
      const env = Math.sin(Math.PI * (i / count));
      const value = Math.sin(2 * Math.PI * note.freq * (i / sampleRate)) * env * 0.42;
      samples[idx] = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
    }
  }
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  bytes.set(new Uint8Array(samples.buffer), 44);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getChime(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!chimeUri) chimeUri = buildChimeUri();
  if (!chimeEl) {
    chimeEl = new Audio(chimeUri);
    chimeEl.preload = "auto";
    chimeEl.volume = 0.65;
  }
  return chimeEl;
}

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
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playWebAudio() {
  const ctx = getContext();
  if (!ctx) return;
  const run = () => {
    const t = ctx.currentTime;
    tone(ctx, 880, t, 0.1, 0.08);
    tone(ctx, 1174.7, t + 0.12, 0.16, 0.07);
  };
  if (ctx.state === "suspended") {
    void ctx.resume().then(run).catch(() => undefined);
    return;
  }
  run();
}

export function unlockNotificationAudio() {
  if (typeof window === "undefined") return;
  const audio = getChime();
  const ctx = getContext();
  if (ctx?.state === "suspended") {
    void ctx.resume().then(() => {
      unlocked = true;
    });
  }
  if (!audio) return;
  audio.muted = true;
  const play = audio.play();
  if (play) {
    void play
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        unlocked = true;
      })
      .catch(() => undefined);
  }
}

export function playNotificationChime() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastPlayedAt < 700) return;
  lastPlayedAt = now;
  const audio = getChime();
  if (audio) {
    audio.muted = false;
    audio.volume = 0.65;
    audio.currentTime = 0;
    const play = audio.play();
    if (play) {
      void play
        .then(() => {
          unlocked = true;
        })
        .catch(() => {
          playWebAudio();
        });
      return;
    }
  }
  playWebAudio();
}

export function isNotificationAudioUnlocked() {
  return unlocked;
}
