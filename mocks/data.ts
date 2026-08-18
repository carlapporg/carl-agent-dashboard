import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";
import type { Itinerary } from "@/types/itinerary";
import type { TimelineEvent } from "@/types/message";
import type {
  PaymentAuthorization,
  Receipt,
  VirtualCardSummary,
} from "@/types/payment";
import type { Task } from "@/types/task";

const now = Date.now();
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

export const mockCustomers: Record<string, CustomerProfile> = {
  cust_john: {
    id: "cust_john",
    name: "John Hale",
    email: "john.hale@example.com",
    phone: "+1 (305) 555-0142",
    notes: "Prefers concise updates. Travel often for work.",
    preferences: [
      { key: "Hotel", value: "4-star+, central location" },
      { key: "Flights", value: "Business class when under $2k" },
      { key: "Dining", value: "Quiet tables, no tasting menus" },
    ],
    familyMembers: [
      {
        id: "fam_1",
        name: "Maya Hale",
        relationship: "Spouse",
        spendingLimit: 500,
      },
    ],
    paymentMethods: [
      { id: "pm_1", brand: "Visa", last4: "4242", isDefault: true },
      { id: "pm_2", brand: "Amex", last4: "1005", isDefault: false },
    ],
    spendingRules: {
      autoApproveUnder: 200,
      monthlyLimit: 5000,
      currency: "USD",
    },
    memberSince: "2024-03-12",
  },
  cust_sara: {
    id: "cust_sara",
    name: "Sara Chen",
    email: "sara.chen@example.com",
    phone: "+1 (212) 555-0198",
    notes: "Family plan. Kids' requests need PIN over $100.",
    preferences: [
      { key: "Restaurants", value: "Kid-friendly, outdoor seating" },
      { key: "Budget", value: "Optimize for value" },
    ],
    familyMembers: [
      {
        id: "fam_2",
        name: "Leo Chen",
        relationship: "Child",
        spendingLimit: 100,
      },
      {
        id: "fam_3",
        name: "Ava Chen",
        relationship: "Child",
        spendingLimit: 100,
      },
    ],
    paymentMethods: [
      { id: "pm_3", brand: "Mastercard", last4: "4444", isDefault: true },
    ],
    spendingRules: {
      autoApproveUnder: 150,
      monthlyLimit: 3000,
      currency: "USD",
    },
    memberSince: "2024-08-01",
  },
};

export let mockTasks: Task[] = [
  {
    id: "task_4821",
    number: 4821,
    title: "Miami hotel booking",
    request: "Book a Miami hotel for next Thursday–Sunday, 4-star near Brickell.",
    status: "waiting_for_payment",
    priority: "high",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: null,
    childIds: [],
    assignedAgentId: "agent_stub_001",
    aiBrief: {
      summary:
        "John needs a 4-star hotel in Brickell, Miami, Thu–Sun. Prefer quiet room, late checkout if possible.",
      missingInfo: [],
      suggestedActions: [
        "Confirm availability at shortlisted hotels",
        "Request payment approval for hold amount",
        "Send confirmation once booked",
      ],
    },
    notes: [
      {
        id: "note_1",
        body: "East Hotel has rooms available at $1,180 total.",
        createdAt: iso(1000 * 60 * 40),
        authorName: "Alex Morgan",
      },
    ],
    suggestedStepsDone: ["Confirm availability at shortlisted hotels"],
    createdAt: iso(1000 * 60 * 90),
    updatedAt: iso(1000 * 60 * 15),
  },
  {
    id: "task_4820",
    number: 4820,
    title: "Friday dinner reservation",
    request: "Find a restaurant for Friday night around 8pm for two.",
    status: "in_progress",
    priority: "normal",
    customerId: "cust_sara",
    customerName: "Sara Chen",
    parentId: null,
    childIds: [],
    assignedAgentId: "agent_stub_001",
    aiBrief: {
      summary:
        "Sara wants dinner Friday ~8pm for two. Kid-friendly acceptable; prefers outdoor seating.",
      missingInfo: ["Cuisine preference", "Neighborhood preference"],
      suggestedActions: [
        "Ask cuisine preference",
        "Shortlist 2–3 options",
        "Book and confirm",
      ],
    },
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 50),
    updatedAt: iso(1000 * 60 * 20),
  },
  {
    id: "task_4819",
    number: 4819,
    title: "London business trip",
    request: "Plan a business trip to London March 10–15.",
    status: "in_progress",
    priority: "urgent",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: null,
    childIds: ["task_4819_flight", "task_4819_hotel", "task_4819_transport", "task_4819_dinner"],
    assignedAgentId: "agent_stub_001",
    aiBrief: {
      summary:
        "Business trip London Mar 10–15. Business class preferred, 4-star hotel near financial district.",
      missingInfo: [],
      suggestedActions: [
        "Complete flight booking",
        "Complete hotel booking",
        "Arrange airport transport",
        "Book welcome dinner",
      ],
    },
    notes: [],
    suggestedStepsDone: ["Complete flight booking", "Complete hotel booking"],
    createdAt: iso(1000 * 60 * 60 * 5),
    updatedAt: iso(1000 * 60 * 30),
  },
  {
    id: "task_4819_flight",
    number: 48191,
    title: "Flight — NYC to London",
    request: "Business class round-trip JFK–LHR Mar 10 / Mar 15.",
    status: "completed",
    priority: "urgent",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: "task_4819",
    childIds: [],
    assignedAgentId: "agent_stub_001",
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 60 * 5),
    updatedAt: iso(1000 * 60 * 60 * 2),
    completedAt: iso(1000 * 60 * 60 * 2),
  },
  {
    id: "task_4819_hotel",
    number: 48192,
    title: "Hotel — London",
    request: "4-star near financial district, Mar 10–15.",
    status: "completed",
    priority: "urgent",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: "task_4819",
    childIds: [],
    assignedAgentId: "agent_stub_001",
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 60 * 5),
    updatedAt: iso(1000 * 60 * 60),
    completedAt: iso(1000 * 60 * 60),
  },
  {
    id: "task_4819_transport",
    number: 48193,
    title: "Airport transport",
    request: "Private transfer LHR to hotel on arrival.",
    status: "in_progress",
    priority: "normal",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: "task_4819",
    childIds: [],
    assignedAgentId: "agent_stub_001",
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 60 * 5),
    updatedAt: iso(1000 * 60 * 45),
  },
  {
    id: "task_4819_dinner",
    number: 48194,
    title: "Welcome dinner",
    request: "Quiet dinner for 2 near hotel on Mar 10.",
    status: "waiting_for_customer",
    priority: "normal",
    customerId: "cust_john",
    customerName: "John Hale",
    parentId: "task_4819",
    childIds: [],
    assignedAgentId: "agent_stub_001",
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 60 * 5),
    updatedAt: iso(1000 * 60 * 25),
  },
  {
    id: "task_4815",
    number: 4815,
    title: "Pharmacy run",
    request: "Pick up prescription refill and drop at home.",
    status: "queued",
    priority: "low",
    customerId: "cust_sara",
    customerName: "Sara Chen",
    parentId: null,
    childIds: [],
    assignedAgentId: null,
    aiBrief: {
      summary: "Prescription pickup and home drop-off for Sara.",
      missingInfo: ["Preferred pharmacy", "Delivery window"],
      suggestedActions: ["Confirm pharmacy", "Accept task", "Schedule pickup"],
    },
    notes: [],
    suggestedStepsDone: [],
    createdAt: iso(1000 * 60 * 10),
    updatedAt: iso(1000 * 60 * 10),
  },
];

export let mockPayments: PaymentAuthorization[] = [
  {
    id: "pay_1",
    taskId: "task_4821",
    amount: 1200,
    remaining: 1200,
    currency: "USD",
    merchant: "East Hotel Miami",
    merchantCategory: "Hotels",
    status: "approved",
    approvedBy: "John Hale",
    approvedAt: iso(1000 * 60 * 12),
    requestedAt: iso(1000 * 60 * 20),
  },
];

export let mockCards: VirtualCardSummary[] = [
  {
    id: "card_1",
    last4: "9182",
    network: "visa",
    spendingLimit: 1200,
    remaining: 1200,
    merchantCategory: "Hotels",
    status: "active",
    taskId: "task_4821",
  },
];

export let mockReceipts: Receipt[] = [];

export let mockTimeline: TimelineEvent[] = [
  {
    id: "ev_1",
    taskId: "task_4821",
    kind: "status_change",
    body: "Task assigned to Alex Morgan",
    createdAt: iso(1000 * 60 * 80),
    visibleToCustomer: true,
  },
  {
    id: "ev_2",
    taskId: "task_4821",
    kind: "agent_message",
    body: "I found East Hotel in Brickell — $1,180 for your dates. Requesting approval.",
    authorName: "Alex Morgan",
    createdAt: iso(1000 * 60 * 25),
    visibleToCustomer: true,
  },
  {
    id: "ev_3",
    taskId: "task_4821",
    kind: "approval_result",
    body: "Payment of $1,200 approved by John Hale",
    createdAt: iso(1000 * 60 * 12),
    visibleToCustomer: true,
  },
  {
    id: "ev_4",
    taskId: "task_4820",
    kind: "agent_message",
    body: "Looking at a few Friday options — any cuisine preference?",
    authorName: "Alex Morgan",
    createdAt: iso(1000 * 60 * 18),
    visibleToCustomer: true,
  },
  {
    id: "ev_5",
    taskId: "task_4819_dinner",
    kind: "approval_requested",
    body: "Waiting on John's cuisine preference for welcome dinner.",
    createdAt: iso(1000 * 60 * 25),
    visibleToCustomer: true,
  },
];

export let mockItineraries: Record<string, Itinerary> = {};

export function getCustomerHistory(customerId: string): CustomerHistoryItem[] {
  return mockTasks
    .filter((t) => t.customerId === customerId && !t.parentId)
    .map((t) => ({
      taskId: t.id,
      taskNumber: t.number,
      title: t.title,
      status: t.status,
      completedAt: t.completedAt ?? null,
    }));
}

export function findTask(id: string): Task | undefined {
  return mockTasks.find((t) => t.id === id);
}

export function updateTask(id: string, patch: Partial<Task>): Task | undefined {
  const index = mockTasks.findIndex((t) => t.id === id);
  if (index < 0) return undefined;
  mockTasks[index] = {
    ...mockTasks[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return mockTasks[index];
}

export function addTimelineEvent(
  event: {
    id?: string;
    createdAt?: string;
    taskId: string;
    kind: TimelineEvent["kind"];
    body: string;
    authorName?: string;
    visibleToCustomer?: boolean;
  },
): TimelineEvent {
  const next: TimelineEvent = {
    id: event.id ?? `ev_${Date.now()}`,
    createdAt: event.createdAt ?? new Date().toISOString(),
    visibleToCustomer: event.visibleToCustomer ?? false,
    taskId: event.taskId,
    kind: event.kind,
    body: event.body,
    authorName: event.authorName,
  };
  mockTimeline = [next, ...mockTimeline];
  return next;
}
