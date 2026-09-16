import { callSchema, type Call } from "@/types/call";

function candidateObjects(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const out: unknown[] = [payload];
  if (record.call) out.push(record.call);
  if (record.data) {
    out.push(record.data);
    if (typeof record.data === "object" && record.data && "call" in record.data) {
      out.push((record.data as { call: unknown }).call);
    }
  }
  if (record.payload) out.push(record.payload);
  return out;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Skip placeholder labels Nest sometimes sends. */
export function isGenericPeerLabel(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /^(client|customer|user|unknown|caller|callee)$/i.test(name.trim());
}

export function preferPeerName(
  ...names: Array<string | null | undefined>
): string | null {
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed && !isGenericPeerLabel(trimmed)) return trimmed;
  }
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function pickNameFromRecord(record: Record<string, unknown>): string | null {
  const client =
    record.client && typeof record.client === "object"
      ? (record.client as Record<string, unknown>)
      : null;
  const fromParts = [asString(client?.firstName), asString(client?.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();

  return preferPeerName(
    asString(record.customerName),
    asString(record.clientName),
    asString(record.calleeName),
    asString(record.callerName),
    asString(record.fromName),
    asString(record.toName),
    asString(record.peerName),
    asString(record.displayName),
    asString(record.fullName),
    asString(record.name),
    fromParts || null,
    asString(client?.displayName),
    asString(client?.fullName),
    asString(client?.name),
    asString(client?.alias),
  );
}

export function parseCallPayload(payload: unknown): Call | null {
  for (const candidate of candidateObjects(payload)) {
    const parsed = callSchema.safeParse(candidate);
    if (parsed.success) {
      const record =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      const livekit =
        record && record.livekit && typeof record.livekit === "object"
          ? (record.livekit as Call["livekit"])
          : parsed.data.livekit;
      const nameFromPayload = record ? pickNameFromRecord(record) : null;
      const nameFromCandidate =
        candidate && typeof candidate === "object"
          ? pickNameFromRecord(candidate as Record<string, unknown>)
          : null;
      return {
        ...parsed.data,
        customerName:
          preferPeerName(
            nameFromPayload,
            nameFromCandidate,
            parsed.data.customerName,
          ) ?? parsed.data.customerName,
        livekit: livekit ?? parsed.data.livekit,
      };
    }
  }

  // Minimal invite payloads (id + taskId + status)
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    const taskId =
      typeof record.taskId === "string"
        ? record.taskId
        : typeof record.task_id === "string"
          ? record.task_id
          : null;
    if (id && taskId) {
      return {
        id,
        taskId,
        type: record.type === "VIDEO" ? "VIDEO" : "AUDIO",
        status:
          typeof record.status === "string"
            ? (record.status as Call["status"])
            : "RINGING",
        roomName:
          typeof record.roomName === "string" ? record.roomName : null,
        callerUserId:
          typeof record.callerUserId === "string"
            ? record.callerUserId
            : null,
        calleeUserId:
          typeof record.calleeUserId === "string"
            ? record.calleeUserId
            : null,
        customerName: pickNameFromRecord(record),
        agentName:
          typeof record.agentName === "string" ? record.agentName : null,
        taskTitle:
          typeof record.taskTitle === "string" ? record.taskTitle : null,
        taskNumber:
          typeof record.taskNumber === "string" ||
          typeof record.taskNumber === "number"
            ? record.taskNumber
            : null,
        livekit: null,
        startedAt: null,
        endedAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  return null;
}

export function callPeerLabel(call: Call, direction: "incoming" | "outgoing") {
  const name = preferPeerName(call.customerName, call.agentName);
  if (name) return name;
  return direction === "incoming" ? "Customer" : "Customer";
}

/** Keep a good local name when Nest omits or sends "Client". */
export function mergeCallPreserveName(prev: Call | null, next: Call): Call {
  return {
    ...prev,
    ...next,
    customerName:
      preferPeerName(next.customerName, prev?.customerName) ??
      next.customerName ??
      prev?.customerName ??
      null,
    taskTitle: next.taskTitle ?? prev?.taskTitle ?? null,
    taskNumber: next.taskNumber ?? prev?.taskNumber ?? null,
  };
}
