"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDocumentTheme,
  readStoredDarkMode,
} from "@/lib/theme/document-theme";

type ThemeContextValue = {
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    const enabled = readStoredDarkMode();
    setDarkModeState(enabled);
    applyDocumentTheme(enabled);
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setDarkModeState(enabled);
    applyDocumentTheme(enabled);
  }, []);

  const value = useMemo(
    () => ({ darkMode, setDarkMode }),
    [darkMode, setDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
