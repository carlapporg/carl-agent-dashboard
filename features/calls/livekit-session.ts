/**
 * Module-level LiveKit session.
 * One room max. Survives React remounts. Avoids DUPLICATE_IDENTITY (leave 2).
 */

import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from "livekit-client";
import type { LivekitCreds } from "@/types/call";

type SessionHandlers = {
  onState?: (label: string, active: boolean) => void;
  onUnexpectedDisconnect?: (callId: string) => void;
};

let room: Room | null = null;
let activeCallId: string | null = null;
let joinPromise: Promise<boolean> | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let handlers: SessionHandlers = {};
/** True while we intentionally hang up — ignore Disconnect noise. */
let intentionalDisconnect = false;

function attachRemoteAudio(track: RemoteTrack) {
  if (track.kind !== Track.Kind.Audio) return;
  const el = remoteAudioEl;
  if (!el) return;
  track.attach(el);
  void el.play().catch(() => undefined);
}

function attachExistingRemoteTracks(current: Room) {
  for (const participant of current.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) {
        attachRemoteAudio(publication.track as RemoteTrack);
      }
    }
  }
}

async function enableMicrophone(current: Room) {
  await current.localParticipant.setMicrophoneEnabled(true);
  // Some browsers need a second kick after connect before the track publishes.
  const pubs = [
    ...current.localParticipant.audioTrackPublications.values(),
  ];
  const hasLiveMic = pubs.some(
    (p) => p.track && !p.isMuted && p.track.kind === Track.Kind.Audio,
  );
  if (!hasLiveMic) {
    await current.localParticipant.setMicrophoneEnabled(false);
    await current.localParticipant.setMicrophoneEnabled(true);
  }
}

function clearSessionPointers() {
  room = null;
  activeCallId = null;
  joinPromise = null;
}

export function setLivekitRemoteAudioElement(el: HTMLAudioElement | null) {
  remoteAudioEl = el;
}

export function setLivekitSessionHandlers(next: SessionHandlers) {
  handlers = next;
}

export function getLivekitCallId() {
  return activeCallId;
}

export function isLivekitJoined(callId?: string) {
  if (!room) return false;
  if (room.state === ConnectionState.Disconnected) return false;
  if (callId) return activeCallId === callId;
  return Boolean(activeCallId);
}

export async function disconnectLivekitSession() {
  intentionalDisconnect = true;
  const current = room;
  clearSessionPointers();
  if (remoteAudioEl) {
    remoteAudioEl.srcObject = null;
  }
  if (!current) {
    intentionalDisconnect = false;
    return;
  }
  try {
    current.removeAllListeners();
    await current.disconnect(true);
  } catch {
    /* ignore */
  }
  intentionalDisconnect = false;
}

export async function setLivekitMicrophoneEnabled(enabled: boolean) {
  if (!room) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(enabled);
  } catch {
    /* ignore */
  }
}

/**
 * Soft credential refresh on the same Room instance.
 * Never creates a second Room (that causes DUPLICATE_IDENTITY).
 */
export async function refreshLivekitSession(input: {
  callId: string;
  creds: LivekitCreds;
}): Promise<boolean> {
  const { callId, creds } = input;
  if (activeCallId !== callId || !room) return false;
  if (!creds.token || !creds.url) return false;
  const current = room;
  try {
    intentionalDisconnect = true;
    await current.disconnect();
    intentionalDisconnect = false;
    if (activeCallId !== callId || room !== current) return false;
    await current.connect(creds.url, creds.token);
    await enableMicrophone(current);
    attachExistingRemoteTracks(current);
    handlers.onState?.("Connected", true);
    return true;
  } catch {
    intentionalDisconnect = false;
    return false;
  }
}

export async function joinLivekitSession(input: {
  callId: string;
  creds: LivekitCreds;
}): Promise<boolean> {
  const { callId, creds } = input;

  if (isLivekitJoined(callId)) {
    // Already in room — make sure mic is actually publishing (outbound regress).
    if (room) {
      try {
        await enableMicrophone(room);
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  if (joinPromise) {
    await joinPromise;
    if (isLivekitJoined(callId) && room) {
      try {
        await enableMicrophone(room);
      } catch {
        /* ignore */
      }
    }
    return isLivekitJoined(callId);
  }

  if (!creds.token || !creds.url) return false;

  // Different call still attached — hang it up first.
  if (room && activeCallId && activeCallId !== callId) {
    await disconnectLivekitSession();
  }

  // Same call, room exists mid-connect — wait for the in-flight join only.
  if (room && activeCallId === callId) {
    if (room.state !== ConnectionState.Disconnected) {
      try {
        await enableMicrophone(room);
      } catch {
        /* ignore */
      }
      return true;
    }
    // Stale disconnected room for this call — clear and continue.
    clearSessionPointers();
  }

  let settle!: (value: boolean) => void;
  joinPromise = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  activeCallId = callId;

  try {
    handlers.onState?.("Connecting…", false);

    const nextRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    nextRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (room !== nextRoom) return;
      if (state === ConnectionState.Connected) {
        handlers.onState?.("Connected", true);
      } else if (state === ConnectionState.Reconnecting) {
        handlers.onState?.("Reconnecting…", true);
      } else if (state === ConnectionState.Disconnected) {
        handlers.onState?.("Disconnected", false);
      }
    });

    nextRoom.on(RoomEvent.TrackSubscribed, (track) => {
      attachRemoteAudio(track);
    });

    nextRoom.on(RoomEvent.Disconnected, () => {
      if (room !== nextRoom) return;
      handlers.onState?.("Disconnected", false);
      const droppedCallId = callId;
      if (!intentionalDisconnect) {
        if (room === nextRoom) {
          room = null;
          if (activeCallId === callId) activeCallId = null;
        }
        handlers.onUnexpectedDisconnect?.(droppedCallId);
      }
    });

    room = nextRoom;

    await nextRoom.connect(creds.url, creds.token, {
      autoSubscribe: true,
    });

    if (room !== nextRoom || activeCallId !== callId) {
      try {
        nextRoom.removeAllListeners();
        await nextRoom.disconnect(true);
      } catch {
        /* ignore */
      }
      settle(false);
      return false;
    }

    await enableMicrophone(nextRoom);
    attachExistingRemoteTracks(nextRoom);
    handlers.onState?.("Connected", true);
    settle(true);
    return true;
  } catch {
    if (activeCallId === callId) {
      await disconnectLivekitSession();
    }
    settle(false);
    return false;
  } finally {
    joinPromise = null;
  }
}
