"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "orbitboard-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // Storage denied (private mode); fall through to the system preference.
  }
  return null;
}

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  for (const listener of themeListeners) listener();
}

function subscribeToTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    // An explicit choice wins over the OS preference.
    if (readStoredTheme()) return;
    applyThemeClass(getSystemTheme());
    notifyThemeListeners();
  };
  mq.addEventListener("change", onSystemChange);
  return () => {
    themeListeners.delete(onChange);
    mq.removeEventListener("change", onSystemChange);
  };
}

function getThemeSnapshot(): ThemeMode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Imperative read for non-React consumers (the WebGL canvas needs a palette at
 * construction time, before any hook has run).
 */
export function getCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return getThemeSnapshot();
}

function getServerThemeSnapshot(): ThemeMode {
  return "light";
}

/**
 * The theme is external state: `public/theme-boot.js` stamps it onto <html>
 * before paint so there is no flash. Reading it through useSyncExternalStore
 * lets React adopt that value during hydration; the previous
 * read-then-setState effect fired a cascading render on every mount.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const setTheme = useCallback((mode: ThemeMode) => {
    applyThemeClass(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Preference is not persisted, but the current session still switches.
    }
    notifyThemeListeners();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getThemeSnapshot() === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
