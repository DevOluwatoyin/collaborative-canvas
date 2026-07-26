"use client";

import type { CanvasObject } from "@infinite-canvas/shared";
import { selectedObjects, type RoomRefs, type RoomStore } from "../store";
import { pasteRoomObjects, type Actor } from "../mutations";

/** Marks clipboard text as ours, so pasting foreign text is ignored. */
const CLIPBOARD_KIND = "orbitboard/objects";

export type ClipboardActions = ReturnType<typeof createClipboardActions>;

/**
 * Copy and paste of canvas objects.
 *
 * Objects travel as JSON text so a copy can cross tabs and windows. The
 * in-memory buffer is a fallback for browsers that refuse clipboard access from
 * a canvas event, where the system clipboard is simply unavailable to us.
 */
export function createClipboardActions(
  store: RoomStore,
  refs: RoomRefs,
  actor: () => Actor,
  removeSelected: () => void
) {
  let buffer: CanvasObject[] = [];

  async function copySelection(cut = false): Promise<number> {
    const objects = selectedObjects(refs, store.getState().selectedIds);
    if (objects.length === 0) return 0;
    buffer = objects;
    try {
      await navigator.clipboard?.writeText(
        JSON.stringify({ type: CLIPBOARD_KIND, objects })
      );
    } catch {
      // System clipboard unavailable; the internal buffer still serves paste.
    }
    if (cut) removeSelected();
    return objects.length;
  }

  async function readClipboard(): Promise<CanvasObject[]> {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        const parsed: unknown = JSON.parse(text);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          (parsed as { type?: string }).type === CLIPBOARD_KIND &&
          Array.isArray((parsed as { objects?: unknown }).objects)
        ) {
          return (parsed as { objects: CanvasObject[] }).objects;
        }
      }
    } catch {
      // Read denied, or the clipboard holds something that is not ours.
    }
    return buffer;
  }

  async function pasteClipboard() {
    const bindings = refs.bindings;
    if (!bindings) return;
    const objects = await readClipboard();
    if (objects.length === 0) return;
    const ids = pasteRoomObjects(bindings, actor(), objects);
    if (ids.length > 0) store.setState({ selectedIds: ids, tool: "select" });
  }

  return { copySelection, pasteClipboard };
}
