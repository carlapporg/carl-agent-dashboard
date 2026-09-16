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

/** True if this call already owns the session (even while connecting). */
export function isLivekitBoundToCall(callId: string) {
  return activeCallId === callId || joinPromise != null;
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
    await current.localParticipant.setMicrophoneEnabled(true);
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

  if (isLivekitJoined(callId)) return true;

  if (joinPromise) {
    await joinPromise;
    return isLivekitJoined(callId);
  }

  if (!creds.token || !creds.url) return false;

  // Different call still attached — hang it up first.
  if (room && activeCallId && activeCallId !== callId) {
    await disconnectLivekitSession();
  }

  // Same call, room exists (connecting or connected) — never open a second one.
  if (room && activeCallId === callId) {
    return room.state !== ConnectionState.Disconnected;
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
      // Server kicked us (e.g. DUPLICATE_IDENTITY) — drop zombie pointers
      // so the next call can join cleanly.
      if (!intentionalDisconnect) {
        if (room === nextRoom) {
          room = null;
          if (activeCallId === callId) activeCallId = null;
        }
      }
    });

    room = nextRoom;

    await nextRoom.connect(creds.url, creds.token);

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

    await nextRoom.localParticipant.setMicrophoneEnabled(true);
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
