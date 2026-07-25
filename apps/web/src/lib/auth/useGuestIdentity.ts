"use client";

import { useSyncExternalStore } from "react";
import type { GuestIdentity } from "@infinite-canvas/shared";
import { getGuestIdentity, subscribeToGuestIdentity } from "./guest";

/**
 * Reads the stored guest identity as external state. The alternative — reading
 * localStorage in an effect and calling setState — produces a guaranteed second
 * render on every mount and trips react-hooks/set-state-in-effect.
 */
export function useGuestIdentity(): GuestIdentity | null {
  return useSyncExternalStore(
    subscribeToGuestIdentity,
    getGuestIdentity,
    () => null
  );
}
