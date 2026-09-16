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
      return { ...parsed.data, livekit: livekit ?? parsed.data.livekit };
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
        customerName:
          typeof record.customerName === "string"
            ? record.customerName
            : typeof record.fromName === "string"
              ? record.fromName
              : null,
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
  if (direction === "incoming") {
    return call.customerName?.trim() || "Customer";
  }
  return call.customerName?.trim() || "Customer";
}
