/**
 * SVG / canvas colors — keep in sync with styles/theme.css :root.
 * Prefer CSS vars in components; use these only where inline SVG needs hex.
 */
export const themeTokens = {
  accent: "#3872e8",
  accentHover: "#2d63d4",
  accentSoft: "#dfeafc",
  accentMuted: "#8fb0ef",
  chartCompleted: "#1a42c4",
  chartProgress: "#3872e8",
  chartQueue: "#c5daf5",
  chartLine: "#3872e8",
  chartFill: "rgba(56, 114, 232, 0.24)",
  chartTrack: "#eef2f7",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  priorityHigh: "#ef4444",
  priorityMedium: "#f59e0b",
  priorityLow: "#10b981",
  foreground: "#1a1c1e",
  muted: "#6b7280",
  border: "#e5e7eb",
  surface: "#ffffff",
  background: "#f8f9fb",
} as const;
