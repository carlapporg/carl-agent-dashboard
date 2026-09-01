import { API_ENDPOINTS } from "@/lib/api/endpoints";

void API_ENDPOINTS;

export type ProfileStats = {
  tasksCompleted: number;
  avgResponseMins: number;
  customerRating: number | null;
};

export type ProfileContactDetails = {
  phone: string | null;
  department: string | null;
  primaryWorkspace: string | null;
};

export type ProfileActivityItem = {
  id: string;
  kind: "resolved" | "message" | "queue";
  title: string;
  detail: string;
  at: string;
  taskId?: string;
};

export type AppSettingsState = {
  language: string;
  timezone: string;
  darkMode: boolean;
  twoFactorEnabled: boolean;
  integrations: {
    slack: boolean;
    stripe: boolean;
    zendesk: boolean;
  };
};

const SETTINGS_KEY = "carl.agent.app-settings";

function stubStats(): ProfileStats {
  return {
    tasksCompleted: 142,
    avgResponseMins: 2.4,
    customerRating: 4.9,
  };
}

function stubDetails(): ProfileContactDetails {
  return {
    phone: "+1 (234) 567-8902",
    department: "Global Operations & Logistics",
    primaryWorkspace: "Lahore & APAC Dispatch",
  };
}

function stubActivity(): ProfileActivityItem[] {
  const now = Date.now();
  return [
    {
      id: "pa_1",
      kind: "resolved",
      title: "Resolved booking dispute #T-2041",
      detail: "Hotel Booking · Approved voucher LUXLAHO",
      at: new Date(now - 10 * 60_000).toISOString(),
    },
    {
      id: "pa_2",
      kind: "message",
      title: "Sent chat response to Ava Chen",
      detail: "Ticket #T-2041 · Active communication initiated",
      at: new Date(now - 60 * 60_000).toISOString(),
    },
    {
      id: "pa_3",
      kind: "queue",
      title: "Opened Live Task queue",
      detail: "Inspected pending 12 requests in APAC region",
      at: new Date(now - 2 * 60 * 60_000).toISOString(),
    },
  ];
}

function defaultSettings(): AppSettingsState {
  return {
    language: "en-US",
    timezone: "Asia/Karachi",
    darkMode: false,
    twoFactorEnabled: true,
    integrations: {
      slack: true,
      stripe: true,
      zendesk: false,
    },
  };
}

function readLocalSettings(): AppSettingsState {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettingsState>;
    const base = defaultSettings();
    return {
      ...base,
      ...parsed,
      integrations: { ...base.integrations, ...parsed.integrations },
    };
  } catch {
    return defaultSettings();
  }
}

function writeLocalSettings(next: AppSettingsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Client-safe stubs until Nest expands /agents/me. */
export const profileExtrasApi = {
  async getStats(): Promise<ProfileStats> {
    // TODO(backend): GET API_ENDPOINTS.agents.profileStats
    return stubStats();
  },

  async getContactDetails(): Promise<ProfileContactDetails> {
    // TODO(backend): GET API_ENDPOINTS.agents.profileDetails
    return stubDetails();
  },

  async getActivity(): Promise<ProfileActivityItem[]> {
    // TODO(backend): GET API_ENDPOINTS.agents.profileActivity
    return stubActivity();
  },
};

export const appSettingsApi = {
  async get(): Promise<AppSettingsState> {
    // TODO(backend): GET API_ENDPOINTS.agents.appSettings
    return readLocalSettings();
  },

  async save(next: AppSettingsState): Promise<AppSettingsState> {
    // TODO(backend): PATCH API_ENDPOINTS.agents.appSettings
    writeLocalSettings(next);
    return next;
  },

  async revokeSessions(): Promise<{ ok: true; message: string }> {
    // TODO(backend): POST API_ENDPOINTS.agents.revokeSessions
    return { ok: true, message: "All sessions revoked (placeholder)." };
  },
};
