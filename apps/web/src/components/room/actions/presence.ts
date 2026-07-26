"use client";

import type { PresenceState } from "@infinite-canvas/shared";
import type { RoomRefs, RoomStore } from "../store";

/** Awareness is throttled to ~16Hz; cursors do not need a frame-accurate feed. */
const PRESENCE_INTERVAL_MS = 60;

export type PresenceActions = ReturnType<typeof createPresenceActions>;

/**
 * Publishes this peer's cursor, viewport and drag state over Yjs awareness.
 *
 * Writes are coalesced — the newest partial wins — and flushed at most every
 * PRESENCE_INTERVAL_MS, with a trailing flush so the final value is never
 * stranded. Without the trailing timer a cursor came to rest one update behind
 * where it actually stopped, and a "drag finished" signal arriving inside the
 * throttle window would never be published at all.
 */
export function createPresenceActions(store: RoomStore, refs: RoomRefs) {
  let lastFlush = 0;
  let pending: Partial<PresenceState> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    timer = null;
    const bindings = refs.bindings;
    const merged = pending;
    if (!bindings || !merged) return;
    pending = null;
    lastFlush = performance.now();

    const { identity } = store.getState();
    const current =
      (bindings.awareness.getLocalState()?.user as PresenceState | undefined) ?? {
        userId: identity.id,
        username: identity.username,
        color: identity.color,
        cursor: null,
        viewportCenter: { x: 0, y: 0 },
        viewport: { x: 0, y: 0, width: 800, height: 600, zoom: 1 },
        draggingIds: [],
      };
    bindings.awareness.setLocalStateField("user", { ...current, ...merged });
  }

  function updatePresence(partial: Partial<PresenceState>) {
    if (!refs.bindings) return;
    pending = { ...(pending ?? {}), ...partial };
    const elapsed = performance.now() - lastFlush;
    if (elapsed >= PRESENCE_INTERVAL_MS) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
      return;
    }
    timer ??= setTimeout(flush, PRESENCE_INTERVAL_MS - elapsed);
  }

  /**
   * Publishes which objects this peer is dragging so the simulation host pins
   * those bodies to the pointer instead of overwriting them with simulated
   * motion.
   */
  function setDraggingIds(ids: string[]) {
    const current = store.getState().draggingIds;
    if (current.length === 0 && ids.length === 0) return;
    store.setState({ draggingIds: ids });
    updatePresence({ draggingIds: ids });
  }

  return { updatePresence, setDraggingIds };
}
