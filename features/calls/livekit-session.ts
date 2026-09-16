/**
 * Module-level LiveKit session.
 * Survives React remounts and guarantees one room join per call id
 * (avoids LiveKit DUPLICATE_IDENTITY / leave reason 2).
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
  onDisconnected?: () => void;
};

let room: Room | null = null;
let activeCallId: string | null = null;
let joinPromise: Promise<boolean> | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let handlers: SessionHandlers = {};

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
  if (!room || room.state === ConnectionState.Disconnected) return false;
  if (callId) return activeCallId === callId;
  return Boolean(activeCallId);
}

export async function disconnectLivekitSession() {
  const current = room;
  room = null;
  activeCallId = null;
  joinPromise = null;
  if (remoteAudioEl) {
    remoteAudioEl.srcObject = null;
  }
  if (!current) return;
  try {
    current.removeAllListeners();
    await current.disconnect(true);
  } catch {
    /* ignore */
  }
}

export async function setLivekitMicrophoneEnabled(enabled: boolean) {
  if (!room) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(enabled);
  } catch {
    /* ignore */
  }
}

export async function refreshLivekitSession(input: {
  callId: string;
  creds: LivekitCreds;
}): Promise<boolean> {
  const { callId, creds } = input;
  if (activeCallId !== callId || !room) return false;
  if (!creds.token || !creds.url) return false;
  try {
    await room.disconnect();
    if (activeCallId !== callId || !room) return false;
    await room.connect(creds.url, creds.token);
    await room.localParticipant.setMicrophoneEnabled(true);
    attachExistingRemoteTracks(room);
    handlers.onState?.("Connected", true);
    return true;
  } catch {
    return false;
  }
}

export async function joinLivekitSession(input: {
  callId: string;
  creds: LivekitCreds;
}): Promise<boolean> {
  const { callId, creds } = input;

  if (
    activeCallId === callId &&
    room &&
    room.state !== ConnectionState.Disconnected
  ) {
    return true;
  }

  if (joinPromise) {
    await joinPromise;
    return (
      activeCallId === callId &&
      Boolean(room) &&
      room!.state !== ConnectionState.Disconnected
    );
  }

  if (!creds.token || !creds.url) return false;

  // Different call still connected — hang it up first.
  if (room && activeCallId && activeCallId !== callId) {
    await disconnectLivekitSession();
  }

  // Same call already has a room object mid-connect — do not start another.
  if (room && activeCallId === callId) {
    return room.state !== ConnectionState.Disconnected;
  }

  let settle!: (value: boolean) => void;
  joinPromise = new Promise<boolean>((resolve) => {
    settle = resolve;
  });

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
      handlers.onDisconnected?.();
    });

    room = nextRoom;
    activeCallId = callId;

    await nextRoom.connect(creds.url, creds.token);

    // Replaced or hung up while connecting.
    if (room !== nextRoom) {
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
