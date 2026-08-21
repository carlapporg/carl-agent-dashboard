/**
 * Agent Dashboard API paths.
 * Full URL = API_BASE_URL + path  (API_BASE_URL already includes /api/v1).
 *
 * Live today: auth + agents.me (+ change-password).
 * Everything else is mocked — swap to apiRequest() when Backend is ready.
 *
 * Comment style: Why → Where → Method / body / out
 */

export const API_ENDPOINTS = {
  // ── Auth ──────────────────────────────────────────────────────────
  auth: {
    /**
     * Why: agent signs in to get a session.
     * Where: /login
     * POST { email, password } → session/tokens (+ set cookie)
     */
    agentLogin: "/auth/agent/login",

    /**
     * Why: new agent creates an account.
     * Where: /register
     * POST { email, password, firstName, lastName, … } → account; then usually auto-login
     */
    agentRegister: "/auth/agent/register",

    /**
     * Why: browser JS cannot read httpOnly auth cookies for WebSocket auth.
     * Where: before opening WS (DashboardWebSocketBridge)
     * POST {} → { ticket, expiresAt } — send ticket in WS `auth` frame
     */
    wsTicket: "/auth/ws-ticket",
  },

  // ── Agent (logged-in “me”) ────────────────────────────────────────
  agents: {
    /**
     * Why: show who is signed in (name, email, avatar data).
     * Where: header, Profile
     * GET → agent profile object
     */
    me: "/agents/me",

    /**
     * Why: agent edits their own profile fields.
     * Where: /profile/edit
     * PATCH { firstName?, lastName?, …allowed fields } → updated profile
     */
    meUpdate: "/agents/me",

    /**
     * Why: secure password change (not profile PATCH).
     * Where: Profile → Change password
     * POST { currentPassword, newPassword }
     */
    changePassword: "/agents/me/change-password",

    /**
     * Why: Backend only auto-assigns work when agent is Online (Busy/Offline pause matching).
     * Where: header Availability toggle (Overview)
     * PATCH { status: "online"|"busy"|"offline" }
     * Side effect: may emit WS agent.availability / agent.forced_offline
     */
    availability: "/agents/me/availability",

    /**
     * Why: skills help matching later; schedule = weekly hours; notifications = Settings toggles.
     * Where: Profile prefs + Settings
     * GET → { skills, schedule, notifications }
     * PATCH { skills?: string[], schedule?: WeekRow[], notifications?: NotifPrefs }
     */
    preferences: "/agents/me/preferences",

    /**
     * Why: show agent performance on Profile (completed, rating, response time). Not money/payouts.
     * Where: Profile (read-only)
     * GET → { completedWeek, avgResponseMins, ratingAvg, onTimeRate, … }
     */
    metrics: "/agents/me/metrics",

    /**
     * Why: Overview “quick stats” cards (today/week completed, avg reply, rating).
     * Where: Overview — poll every few minutes (not realtime WS)
     * GET ?period=day|week → { completedToday, completedWeek, avgResponseMins, ratingAvg }
     */
    stats: "/agents/me/stats",

    /**
     * Why: small peek of incoming/assigned work on Overview (not full /tasks page).
     * Where: Overview → Live queue preview (2–3 cards + SLA timer)
     * GET ?limit=3 → [{ id, number, title, summary, taskType, tier?, priority, expiresAt, … }]
     * expiresAt is required for countdown (server clock wins)
     */
    queuePreview: "/agents/me/queue/preview",

    /**
     * Why: list work the agent already started / must act on (separate from queue peek).
     * Where: Overview → Active tasks
     * GET → [{ id, number, title, customerLabel, status, unreadCount, pendingApprovalCount, actionRequired, … }]
     * unreadCount vs pendingApprovalCount are two different badges
     */
    activeTasks: "/agents/me/tasks/active",

    /**
     * Why: urgent banners (payment approved/declined, SLA reply, escalation) on Overview.
     * Where: Overview → Alerts strip (deeplink to task ?panel=)
     * GET → [{ id, kind, title, body, taskId?, panel?, createdAt }]
     */
    alerts: "/agents/me/alerts",

    /**
     * Why: agent clears an alert so it stops showing.
     * Where: Overview alert → Dismiss
     * POST — no body (id in URL)
     */
    alertDismiss: (id: string) => `/agents/me/alerts/${id}/dismiss` as const,

    /**
     * Why: hide alert temporarily without deleting it.
     * Where: Overview alert → Snooze
     * POST { until?: ISO datetime } — omit until = Backend default snooze window
     */
    alertSnooze: (id: string) => `/agents/me/alerts/${id}/snooze` as const,

    /**
     * Why: left column on Messages — all chats across tasks, sorted by last activity.
     * Where: /messages
     * GET → [{ taskId, taskNumber, taskTitle, taskStatus, lastMessage, lastActivityAt, unreadCount }]
     * Opening a row then loads tasks.messages for that taskId
     */
    conversations: "/agents/me/conversations",

    /**
     * Why: full chronological notification center (same events as alerts, full history).
     * Where: /notifications (nav: Alerts)
     * GET → [{ id, title, body, createdAt, read, taskId?, panel? }]
     */
    notifications: "/agents/me/notifications",

    /**
     * Why: mark one notification as read when agent opens it.
     * Where: /notifications
     * POST — no body
     */
    notificationRead: (id: string) =>
      `/agents/me/notifications/${id}/read` as const,

    /**
     * Why: clear unread badge in one click.
     * Where: /notifications → Mark all read
     * POST — no body
     */
    notificationsReadAll: "/agents/me/notifications/read-all",

    /**
     * Why: Payments overview — approvals waiting on the client (across all tasks).
     * Where: /payments (read-only; click → task ?panel=payment)
     * GET → payment auth rows with status "pending"
     */
    paymentsPending: "/agents/me/payments/pending",

    /**
     * Why: show issued virtual cards agent can use after client approved spend.
     * Where: /payments — Active cards
     * GET → [{ id, last4, network, spendingLimit, remaining, taskId, status }] — never full card number
     */
    paymentsCards: "/agents/me/payments/cards",

    /**
     * Why: audit trail of payment requests / charges / outcomes across tasks.
     * Where: /payments — Transaction history
     * GET → [{ id, taskId, amount, merchant, status, at, … }]
     */
    paymentsTransactions: "/agents/me/payments/transactions",
  },

  // ── Tasks ─────────────────────────────────────────────────────────
  tasks: {
    /**
     * Why: main task list + kanban; also History when status=completed.
     * Where: /tasks, /history
     * GET ?view=queue|active|history & status= & q= & type= & from= & to=
     * Out: Task[] (aiBrief, expiresAt, tier, taskType, requiresPayment, parentId/childIds, …)
     * Auto-assign: no Accept/Decline — UI only Opens workspace
     */
    list: "/tasks",

    /**
     * Why: load one task for the workspace (title, request, status, AI brief, steps done, …).
     * Where: /tasks/[taskId]
     * GET → Task (full). Related data often loaded via messages / payments / customers below
     */
    detail: (id: string) => `/tasks/${id}` as const,

    /**
     * Why: optional catch-all if Backend prefers one PATCH instead of many small routes.
     * Where: rare (prefer start / complete / toggleStep)
     * PATCH { …allowed Task fields }
     */
    patch: (id: string) => `/tasks/${id}` as const,

    /**
     * Why: agent begins work after Backend already assigned the task.
     * Where: workspace primary button “Start task”
     * POST — empty body → status in_progress; client app gets status push via WS
     */
    start: (id: string) => `/tasks/${id}/start` as const,

    /**
     * Why: finish the job when checklist (+ payment if required) is done.
     * Where: workspace “Complete task”
     * POST — empty body. Server validates gates; 409 + reasons if blocked
     */
    complete: (id: string) => `/tasks/${id}/complete` as const,

    /**
     * Why: tick/untick AI suggested steps (checklist progress %).
     * Where: workspace → Task steps
     * POST — empty body; stepId = stable id or encoded step label from aiBrief.suggestedActions
     * Out: updated suggestedStepsDone[]
     */
    toggleStep: (id: string, stepId: string) =>
      `/tasks/${id}/steps/${stepId}/toggle` as const,

    /**
     * Why: audit trail split system vs agent (workspace “Action log”).
     * Where: workspace → More details → Action log
     * GET → timeline events [{ id, kind, body, createdAt, authorRole?, … }]
     */
    actionLog: (id: string) => `/tasks/${id}/action-log` as const,

    /**
     * Why: agent ↔ client chat for this task (inbox + Messages page thread).
     * Where: workspace Inbox, /messages selected thread
     * GET → messages/timeline for task
     * POST { body: string, kind?: "question"|"answer"|"clarification"|"status"|"progress" }
     * Labels: You/Client/System only — never real names/emails on either side
     * After POST, Backend pushes message.created on WS to agent + mobile client
     */
    messages: (id: string) => `/tasks/${id}/messages` as const,

    /**
     * Why: clear unread on a conversation when agent opens the thread.
     * Where: Messages / workspace inbox open
     * POST { upToMessageId?: string } — omit = mark all current as read
     */
    messagesRead: (id: string) => `/tasks/${id}/messages/read` as const,

    /**
     * Why: agent asks client to approve money before booking/paying a merchant.
     * Where: workspace Payment panel; also drives /payments pending
     * GET → authorizations for this task
     * POST { amount: number, merchant: string, merchantCategory?: string, description?: string }
     * → creates pending auth; task often → waiting_for_payment; client app must approve/decline
     * Status: pending | approved | declined | expired | spent
     * Partial approve: approvedAmount may be < amount; remaining tracks spend left
     */
    paymentRequests: (id: string) => `/tasks/${id}/payment-requests` as const,

    /**
     * Why: after client approves, agent needs a card to pay the merchant (masked only).
     * Where: workspace Payment panel (show only when approved/spent)
     * GET → { last4, network, spendingLimit, remaining, status } or 404 if none
     * Never return full PAN / CVV
     */
    paymentCard: (id: string) => `/tasks/${id}/payment-card` as const,

    /**
     * Why: record that agent spent part of the approved limit at a merchant.
     * Where: workspace payment / mark paid flow
     * POST { authorizationId: string, amount: number } → updates remaining; may set status spent
     */
    paymentCharge: (id: string) => `/tasks/${id}/payment-charges` as const,

    /**
     * Why: attach proof of purchase to an authorization (reconcilation).
     * Where: workspace Receipts
     * GET → receipts for task
     * POST { fileName, amount?, merchant?, authorizationId? } (+ multipart/signed URL as agreed)
     */
    receipts: (id: string) => `/tasks/${id}/receipts` as const,

    /**
     * Why: load existing parent-trip itinerary (flight+hotel+… summary).
     * Where: workspace Itinerary (parent tasks with childIds only)
     * GET → Itinerary | null
     */
    itinerary: (id: string) => `/tasks/${id}/itinerary` as const,

    /**
     * Why: build itinerary from completed subtasks (parent only).
     * Where: workspace → Generate itinerary
     * POST — empty body; 400 if subtasks incomplete
     */
    itineraryGenerate: (id: string) =>
      `/tasks/${id}/itinerary/generate` as const,

    /**
     * Why: agent reviews AI/generated plan before client sees it.
     * Where: workspace → Confirm itinerary
     * POST — empty body → sets agentConfirmedAt
     */
    itineraryConfirm: (id: string) =>
      `/tasks/${id}/itinerary/confirm` as const,

    /**
     * Why: deliver confirmed itinerary to the client app.
     * Where: workspace → Send to client
     * POST — empty body; requires confirm first; may complete parent task
     */
    itinerarySend: (id: string) => `/tasks/${id}/itinerary/send` as const,
  },

  // ── Customers ─────────────────────────────────────────────────────
  customers: {
    /**
     * Why: show who the task is for + masked payment methods + prefs (not full PII dump).
     * Where: workspace → More details → Customer
     * GET → { id, name, notes?, paymentMethods: [{ brand, last4 }], preferences, spendingRules, … }
     */
    detail: (id: string) => `/customers/${id}` as const,

    /**
     * Why: “N past tasks” context so agent knows the relationship.
     * Where: workspace Customer snippet
     * GET → [{ taskId, taskNumber, title, status, completedAt? }]
     */
    history: (id: string) => `/customers/${id}/history` as const,

    /**
     * Why: agent saves private notes about the customer for next time.
     * Where: workspace Customer → Save notes
     * PATCH { notes: string }
     */
    notes: (id: string) => `/customers/${id}/notes` as const,
  },
} as const;

/** Screen → which endpoints matter (Backend handoff cheat sheet) */
export const API_BY_SCREEN = {
  overview: [
    "availability",
    "queuePreview",
    "activeTasks",
    "alerts",
    "stats",
  ],
  tasks: ["tasks.list", "WS queue"],
  workspace: [
    "tasks.detail/start/complete/steps",
    "messages",
    "payment*",
    "receipts",
    "itinerary*",
    "customers.*",
    "WS task.messages + payment.*",
  ],
  messages: ["conversations", "tasks.messages", "WS task.messages"],
  payments: ["paymentsPending", "paymentsCards", "paymentsTransactions"],
  history: ["tasks.list?status=completed"],
  notifications: ["notifications*", "WS alert.*"],
  profileSettings: ["me", "preferences", "metrics", "availability"],
} as const;

/**
 * Payment authorization lifecycle:
 * pending (waiting on client) → approved | declined | expired → spent (limit used up)
 */
export const PAYMENT_AUTH_STATES = [
  "pending",
  "approved",
  "declined",
  "expired",
  "spent",
] as const;

/**
 * Task lifecycle (auto-assign):
 * queued → assigned → in_progress | waiting_for_customer | waiting_for_payment → completed
 * Also terminal: cancelled | failed
 */
export const TASK_STATUSES = [
  "queued",
  "assigned",
  "in_progress",
  "waiting_for_customer",
  "waiting_for_payment",
  "completed",
  "cancelled",
  "failed",
] as const;

/** Native WS subscribe channels (see types/websocket.ts for event names) */
export const WS_CHANNELS = {
  /** Live queue / assignment updates for Overview + /tasks */
  queue: "queue",
  /** Chat + progress for one task (pass taskId) */
  taskMessages: "task.messages",
  /** Alert/notification fanout for this agent */
  agentAlerts: "agent.alerts",
  /** Payment status fanout for this agent */
  agentPayments: "agent.payments",
} as const;
