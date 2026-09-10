/** Client-only: hide activity-log rows from History (no delete API yet). */

export const HIDDEN_ACTIVITY_KEY = "carl.agent.hidden-activity-ids";
const MAX_HIDDEN = 200;

let memoryHidden = new Set<string>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(HIDDEN_ACTIVITY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    memoryHidden = new Set(
      parsed.filter((id): id is string => typeof id === "string" && Boolean(id)),
    );
  } catch {
    memoryHidden = new Set();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const ids = [...memoryHidden].slice(0, MAX_HIDDEN);
    window.localStorage.setItem(HIDDEN_ACTIVITY_KEY, JSON.stringify(ids));
  } catch {
    // Private mode / blocked storage.
  }
}

export function readHiddenActivityIds(): Set<string> {
  hydrate();
  return new Set(memoryHidden);
}

export function hideActivityId(id: string): Set<string> {
  hydrate();
  memoryHidden.add(id);
  if (memoryHidden.size > MAX_HIDDEN) {
    memoryHidden = new Set([...memoryHidden].slice(-MAX_HIDDEN));
  }
  persist();
  return new Set(memoryHidden);
}
