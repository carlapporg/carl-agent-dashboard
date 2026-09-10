/** Shared with Settings localStorage (`appSettingsApi`). */
export const APP_SETTINGS_STORAGE_KEY = "carl.agent.app-settings";

export function readStoredDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { darkMode?: unknown };
    return parsed.darkMode === true;
  } catch {
    return false;
  }
}

export function applyDocumentTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
}
