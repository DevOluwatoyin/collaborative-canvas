import { GUEST_COLORS, type GuestIdentity } from "@infinite-canvas/shared";

const STORAGE_KEY = "infinite-canvas-guest";
const ONBOARDING_KEY = "orbitboard-onboarding-done";

/**
 * Cached so repeated reads return a referentially stable object. That is a
 * requirement for useSyncExternalStore, which re-renders forever if the snapshot
 * getter allocates a new value each call.
 */
let cached: GuestIdentity | null = null;
let cacheLoaded = false;
const listeners = new Set<() => void>();

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function randomColor(): string {
  return GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
}

function readFromStorage(): GuestIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as GuestIdentity).id === "string" &&
      typeof (parsed as GuestIdentity).username === "string" &&
      typeof (parsed as GuestIdentity).color === "string"
    ) {
      return parsed as GuestIdentity;
    }
  } catch {
    // Unparseable or blocked storage is treated as "no identity yet".
  }
  return null;
}

export function getGuestIdentity(): GuestIdentity | null {
  if (typeof window === "undefined") return null;
  if (!cacheLoaded) {
    cached = readFromStorage();
    cacheLoaded = true;
  }
  return cached;
}

export function subscribeToGuestIdentity(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setGuestIdentity(username: string): GuestIdentity {
  const existing = getGuestIdentity();
  const identity: GuestIdentity = {
    id: existing?.id ?? randomId(),
    username: username.trim().slice(0, 32) || "Guest",
    color: existing?.color ?? randomColor(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    // New guests should see the feature tour on first room entry.
    if (!existing) localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Private mode / storage denied — keep identity in memory for this session.
  }
  cached = identity;
  cacheLoaded = true;
  for (const listener of listeners) listener();
  return identity;
}

export function ensureGuestIdentity(fallbackName = "Guest"): GuestIdentity {
  return getGuestIdentity() ?? setGuestIdentity(fallbackName);
}

/**
 * Forgets the guest identity so the next room entry asks for a name again.
 * Canvas content is unaffected: rooms are shared documents, not user data.
 */
export function clearGuestIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage denied; clearing the in-memory cache below is still enough.
  }
  cached = null;
  cacheLoaded = true;
  for (const listener of listeners) listener();
}
