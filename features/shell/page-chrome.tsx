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

export type PageChrome = {
  title: string;
  subtitle?: string;
};

type PageChromeContextValue = {
  chrome: PageChrome | null;
  setChrome: (next: PageChrome | null) => void;
};

const PageChromeContext = createContext<PageChromeContextValue | null>(null);

function chromeEquals(a: PageChrome | null, b: PageChrome | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.title === b.title && a.subtitle === b.subtitle;
}

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChrome | null>(null);

  const setChrome = useCallback((next: PageChrome | null) => {
    setChromeState((prev) => (chromeEquals(prev, next) ? prev : next));
  }, []);

  const value = useMemo(
    () => ({ chrome, setChrome }),
    [chrome, setChrome],
  );

  return (
    <PageChromeContext.Provider value={value}>
      {children}
    </PageChromeContext.Provider>
  );
}

export function usePageChrome() {
  return useContext(PageChromeContext);
}

/** Sets dashboard header title/subtitle for the current page. */
export function PageChromeSetter({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const setChrome = usePageChrome()?.setChrome;

  useEffect(() => {
    if (!setChrome) return;
    setChrome({ title, subtitle });
    return () => setChrome(null);
  }, [setChrome, title, subtitle]);

  return null;
}
