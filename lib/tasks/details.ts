import type { Task } from "@/types/task";

export type TaskFact = {
  key: string;
  label: string;
  value: string;
};

const KEY_LABELS: Record<string, string> = {
  pickup: "Pickup address",
  pickupAddress: "Pickup address",
  pickupArea: "Pickup area",
  pickupCity: "Pickup city",
  destination: "Destination address",
  destinationAddress: "Destination address",
  destinationArea: "Destination area",
  destinationCity: "Destination city",
  dropoff: "Destination address",
  dropoffArea: "Destination area",
  dropoffCity: "Destination city",
  time: "Pickup time",
  pickupTime: "Pickup time",
  date: "Date",
  guests: "Guests",
  hotel: "Hotel",
  restaurant: "Restaurant",
};

function titleCase(value: string): string {
  return value
    .split(/([\s,/-]+)/)
    .map((part) => {
      if (!/[a-zA-Z]/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function humanizeKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return titleCase(spaced);
}

function typePrefix(taskType?: string): string {
  const type = (taskType ?? "TASK").toUpperCase();
  if (type.includes("CAB") || type.includes("RIDE")) return "CAB";
  if (type.includes("HOTEL")) return "HTL";
  if (type.includes("RESTAURANT") || type.includes("FOOD")) return "RST";
  const letters = type.replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || "TSK";
}

function typeLabel(taskType?: string): string {
  const type = (taskType ?? "").toUpperCase();
  if (type.includes("CAB") || type.includes("RIDE")) return "Cab booking";
  if (type.includes("HOTEL")) return "Hotel booking";
  if (type.includes("RESTAURANT")) return "Restaurant reservation";
  if (!taskType) return "Task";
  return titleCase(taskType.replaceAll("_", " ").toLowerCase());
}

export function taskDisplayCode(task: Task): string {
  if (task.code) return task.code;
  const created = new Date(task.createdAt);
  const stamp = Number.isNaN(created.getTime())
    ? "000000"
    : created.toISOString().slice(2, 10).replaceAll("-", "");
  const seq = task.id.replaceAll("-", "").slice(-4).toUpperCase();
  return `${typePrefix(task.taskType)}-${stamp}-${seq}`;
}

export function taskDisplayTitle(task: Task): string {
  const facts = taskFacts(task);
  const pickup =
    facts.find((f) => f.key === "pickup" || f.key === "pickupAddress")?.value;
  const destination =
    facts.find(
      (f) =>
        f.key === "destination" ||
        f.key === "destinationAddress" ||
        f.key === "dropoff",
    )?.value;
  const kind = typeLabel(task.taskType);
  if (pickup && destination) return `${kind}: ${pickup} → ${destination}`;
  if (pickup) return `${kind}: ${pickup}`;
  return task.title;
}

export function taskFacts(task: Task): TaskFact[] {
  const facts: TaskFact[] = [];
  const seen = new Set<string>();

  function add(key: string, raw: unknown) {
    if (raw == null) return;
    const value = String(raw).trim();
    if (!value || seen.has(key)) return;
    seen.add(key);
    facts.push({ key, label: humanizeKey(key), value: titleCase(value) });
  }

  const metadata = task.metadata;
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "object" && value != null) continue;
      add(key, value);
    }
  }

  const blob = task.request ?? "";
  if (facts.length === 0 && blob.includes(":")) {
    const parts = blob.split("·").map((part) => part.trim());
    for (const part of parts) {
      const index = part.indexOf(":");
      if (index <= 0) continue;
      add(part.slice(0, index).trim(), part.slice(index + 1));
    }
  }

  return facts;
}

export type GeneratedStep = {
  id: string;
  label: string;
  message: string;
};

export function generatedSteps(task: Task): GeneratedStep[] {
  const facts = taskFacts(task);
  const has = (key: string) => facts.some((f) => f.key === key);
  const steps: GeneratedStep[] = [
    {
      id: "review",
      label: "Review task details",
      message: "Step completed: task details reviewed.",
    },
  ];

  if (has("pickup") || has("pickupAddress") || has("pickupArea")) {
    steps.push({
      id: "pickup",
      label: "Verify pickup location",
      message: "Step completed: pickup location verified.",
    });
  }
  if (has("destination") || has("destinationAddress") || has("dropoff")) {
    steps.push({
      id: "destination",
      label: "Verify destination",
      message: "Step completed: destination verified.",
    });
  }
  if (has("hotel")) {
    steps.push({
      id: "hotel",
      label: "Confirm hotel details",
      message: "Step completed: hotel details confirmed.",
    });
  }
  if (has("restaurant")) {
    steps.push({
      id: "restaurant",
      label: "Confirm restaurant details",
      message: "Step completed: restaurant details confirmed.",
    });
  }

  steps.push({
    id: "confirm",
    label: "Confirm with client",
    message: "Step completed: details confirmed with the client.",
  });

  return steps;
}
