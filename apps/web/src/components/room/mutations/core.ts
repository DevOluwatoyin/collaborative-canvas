import { nanoid } from "nanoid";
import type { CanvasObject, GuestIdentity } from "@infinite-canvas/shared";
import { appendHistory, type RoomBindings } from "@/lib/yjs/provider";
import { deleteYObject, patchYObject, upsertYObject } from "@/lib/yjs/objects";
import {
  historyOpFromCreate,
  historyOpFromDelete,
  historyOpFromUpdate,
} from "@/lib/history/replay";

/** Who a mutation is attributed to in the op log. */
export type Actor = Pick<GuestIdentity, "id" | "username">;

/** The style newly created objects inherit from the style panel. */
export type ObjectStyle = {
  color: string;
  fontSize: number;
  strokeWidth: number;
  opacity: number;
};

export type MediaResult<T> = ({ ok: true } & T) | { ok: false; message: string };

export function newObjectId(): string {
  return nanoid(10);
}

/**
 * Puts new objects on top without scanning every object's zIndex. A timestamp is
 * monotonic per client and good enough for paint order; ties across clients are
 * resolved arbitrarily but consistently, since every peer sorts the same values.
 */
function nextZIndex(): number {
  return Date.now();
}

export { nextZIndex };

export function updateRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  id: string,
  patch: Partial<CanvasObject>,
  recordHistory = true
) {
  patchYObject(bindings.objects, id, patch);
  if (recordHistory) {
    appendHistory(
      bindings.history,
      historyOpFromUpdate(id, patch, actor.id, actor.username)
    );
  }
}

export function deleteRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  id: string
) {
  bindings.doc.transact(() => {
    deleteYObject(bindings.objects, id);
    appendHistory(
      bindings.history,
      historyOpFromDelete(id, actor.id, actor.username)
    );
  });
}

function createRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  obj: CanvasObject
): void {
  bindings.doc.transact(() => {
    upsertYObject(bindings.objects, obj);
    appendHistory(
      bindings.history,
      historyOpFromCreate(obj, actor.id, actor.username)
    );
  });
}

/** Records a prop patch and its history op in one transaction. */
function patchProps(
  bindings: RoomBindings,
  actor: Actor,
  id: string,
  props: Record<string, unknown>
): void {
  bindings.doc.transact(() => {
    patchYObject(bindings.objects, id, { props });
    appendHistory(
      bindings.history,
      historyOpFromUpdate(id, { props }, actor.id, actor.username)
    );
  });
}

export { createRoomObject, patchProps };
