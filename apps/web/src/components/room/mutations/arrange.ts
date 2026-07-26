import { createCanvasObject, type CanvasObject } from "@infinite-canvas/shared";
import { appendHistory, type RoomBindings } from "@/lib/yjs/provider";
import { readObject, upsertYObject } from "@/lib/yjs/objects";
import { historyOpFromCreate } from "@/lib/history/replay";
import {
  newObjectId,
  nextZIndex,
  updateRoomObject,
  type Actor,
} from "./core";

const DUPLICATE_OFFSET = 24;

/** Copies objects with fresh ids, nudged so the copy is visibly on top. */
/**
 * Inserts objects that came from the clipboard. Ids are always regenerated so a
 * paste into the room the objects were copied from creates copies rather than
 * silently overwriting the originals.
 */
export function pasteRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  objects: readonly CanvasObject[]
): string[] {
  const created: string[] = [];
  bindings.doc.transact(() => {
    for (const source of objects) {
      if (!source || typeof source !== "object") continue;
      const copy = createCanvasObject({
        ...source,
        id: newObjectId(),
        x: (source.x ?? 0) + DUPLICATE_OFFSET,
        y: (source.y ?? 0) + DUPLICATE_OFFSET,
        zIndex: nextZIndex(),
        createdBy: actor.id,
        props: { ...(source.props ?? {}) },
      });
      upsertYObject(bindings.objects, copy);
      appendHistory(
        bindings.history,
        historyOpFromCreate(copy, actor.id, actor.username)
      );
      created.push(copy.id);
    }
  });
  return created;
}

export function duplicateRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  ids: readonly string[]
): string[] {
  const created: string[] = [];
  bindings.doc.transact(() => {
    for (const id of ids) {
      const source = bindings.objects.get(id);
      if (!source) continue;
      const original = readObject(source);
      const copy = createCanvasObject({
        ...original,
        id: newObjectId(),
        x: original.x + DUPLICATE_OFFSET,
        y: original.y + DUPLICATE_OFFSET,
        zIndex: nextZIndex(),
        createdBy: actor.id,
        props: { ...original.props },
      });
      upsertYObject(bindings.objects, copy);
      appendHistory(
        bindings.history,
        historyOpFromCreate(copy, actor.id, actor.username)
      );
      created.push(copy.id);
    }
  });
  return created;
}

/**
 * Moves objects to the front or back of the paint order. zIndex is a plain
 * number, so this only has to clear the current extreme.
 */
export function reorderRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  ids: readonly string[],
  edge: "front" | "back"
): void {
  if (ids.length === 0) return;
  let min = Infinity;
  let max = -Infinity;
  bindings.objects.forEach((y) => {
    const z = Number(y.get("zIndex") ?? 0);
    if (z < min) min = z;
    if (z > max) max = z;
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;

  bindings.doc.transact(() => {
    ids.forEach((id, index) => {
      const zIndex = edge === "front" ? max + 1 + index : min - 1 - index;
      updateRoomObject(bindings, actor, id, { zIndex });
    });
  });
}
