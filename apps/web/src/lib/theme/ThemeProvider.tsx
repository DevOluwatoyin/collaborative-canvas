"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type ThemeMode = "light" | "dark";

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

/**
 * Pins an explicit choice. Without a class the stylesheet resolves the palette
 * from `color-scheme: light dark`, i.e. the OS preference, so "follow the
 * system" is the absence of a class rather than a stamped value.
 */
function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.dataset.theme = mode;
}

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  for (const listener of themeListeners) listener();
}

function subscribeToTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    // An explicit choice wins over the OS preference; otherwise the stylesheet
    // has already followed the change and only React needs telling.
    if (readStoredTheme()) return;
    notifyThemeListeners();
  };
  const onStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const stored = readStoredTheme();
      if (stored) {
        applyThemeClass(stored);
      } else {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        delete root.dataset.theme;
      }
      notifyThemeListeners();
    }
  };

  mq.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorageChange);
  return () => {
    themeListeners.delete(onChange);
    mq.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorageChange);
  };
}

function getThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") return "light";
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "dark" || explicit === "light") return explicit;
  const stored = readStoredTheme();
  if (stored) return stored;
  return getSystemTheme();
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
 * The theme is external state owned by the document element. Reading it through
 * useSyncExternalStore lets React adopt it during hydration; the previous
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
