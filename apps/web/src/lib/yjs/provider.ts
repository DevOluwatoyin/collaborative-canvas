"use client";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Awareness } from "y-protocols/awareness";
import type {
  CanvasObject,
  GuestIdentity,
  HistoryOp,
  PresenceState,
} from "@infinite-canvas/shared";
import { foldOps } from "@/lib/history/replay";
import { readAllObjects, type YObjects } from "./objects";

export const COLLAB_URL =
  process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:1234";

/**
 * The op log is trimmed so the CRDT document cannot grow without bound, but the
 * trimmed prefix is folded into a base snapshot first. Replay therefore always
 * reconstructs the full session: snapshot + surviving ops, never a partial
 * canvas built from updates whose `create` was thrown away.
 */
export const HISTORY_SOFT_LIMIT = 4000;
export const HISTORY_FOLD_CHUNK = 1000;

const META_HISTORY_BASE = "historyBase";
const META_HISTORY_BASE_COUNT = "historyBaseCount";

export type RoomBindings = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  persistence: IndexeddbPersistence | null;
  persistenceAvailable: boolean;
  objects: YObjects;
  history: Y.Array<HistoryOp>;
  meta: Y.Map<unknown>;
  awareness: Awareness;
};

type PersistenceWithDb = IndexeddbPersistence & {
  _db?: Promise<IDBDatabase>;
};

function tryCreatePersistence(roomId: string, doc: Y.Doc): IndexeddbPersistence | null {
  if (typeof indexedDB === "undefined") return null;
  try {
    const persistence = new IndexeddbPersistence(
      `room-${roomId}`,
      doc
    ) as PersistenceWithDb;

    // y-indexeddb does not catch open failures (e.g. private browsing denial).
    // Attach a handler so the rejection does not crash the app.
    void persistence._db?.catch((err: unknown) => {
      console.warn(
        "[orbitboard] IndexedDB unavailable — offline cache disabled:",
        err
      );
      void persistence.destroy().catch(() => undefined);
    });

    persistence.on("error", (err: unknown) => {
      console.warn("[orbitboard] IndexedDB persistence error:", err);
    });

    return persistence;
  } catch (err) {
    console.warn(
      "[orbitboard] IndexedDB blocked — continuing without offline cache:",
      err
    );
    return null;
  }
}

export function createRoomBindings(
  roomId: string,
  identity: GuestIdentity
): RoomBindings {
  const doc = new Y.Doc();
  const persistence = tryCreatePersistence(roomId, doc);
  const provider = new WebsocketProvider(COLLAB_URL, roomId, doc, {
    connect: true,
  });

  const objects: YObjects = doc.getMap("objects");
  const history = doc.getArray<HistoryOp>("history");
  const meta = doc.getMap("meta");

  if (!meta.get("createdAt")) {
    doc.transact(() => {
      meta.set("createdAt", Date.now());
      meta.set("createdBy", identity.username);
      meta.set("name", `Room ${roomId.slice(0, 6)}`);
    });
  }

  const awareness = provider.awareness;
  awareness.setLocalStateField("user", {
    userId: identity.id,
    username: identity.username,
    color: identity.color,
    cursor: null,
    viewportCenter: { x: 0, y: 0 },
    viewport: { x: 0, y: 0, width: 800, height: 600, zoom: 1 },
  } satisfies PresenceState);

  return {
    doc,
    provider,
    persistence,
    persistenceAvailable: persistence !== null,
    objects,
    history,
    meta,
    awareness,
  };
}

export function destroyRoomBindings(bindings: RoomBindings) {
  bindings.awareness.setLocalState(null);
  bindings.provider.destroy();
  if (bindings.persistence) {
    void bindings.persistence.destroy().catch(() => undefined);
  }
  bindings.doc.destroy();
}

export function appendHistory(history: Y.Array<HistoryOp>, op: HistoryOp) {
  history.push([op]);
}

export function getHistoryBase(meta: Y.Map<unknown>): CanvasObject[] {
  const base = meta.get(META_HISTORY_BASE);
  return Array.isArray(base) ? (base as CanvasObject[]) : [];
}

export function getHistoryBaseCount(meta: Y.Map<unknown>): number {
  const count = meta.get(META_HISTORY_BASE_COUNT);
  return typeof count === "number" ? count : 0;
}

/**
 * Compacts the head of the op log into the base snapshot. Only ever called by
 * the elected host: two clients deleting from the front of the same Y.Array
 * concurrently address different items and can remove more than intended.
 */
export function foldHistory(bindings: RoomBindings): boolean {
  const { history, meta, doc } = bindings;
  if (history.length <= HISTORY_SOFT_LIMIT) return false;

  const chunk = Math.min(HISTORY_FOLD_CHUNK, history.length - HISTORY_SOFT_LIMIT);
  if (chunk <= 0) return false;

  const ops = history.slice(0, chunk);
  const folded = foldOps(ops, getHistoryBase(meta));

  doc.transact(() => {
    meta.set(META_HISTORY_BASE, folded);
    meta.set(META_HISTORY_BASE_COUNT, getHistoryBaseCount(meta) + chunk);
    history.delete(0, chunk);
  });
  return true;
}

export function getAllObjects(objects: YObjects): CanvasObject[] {
  return readAllObjects(objects);
}

export function getRemotePresence(
  awareness: Awareness,
  selfId: string
): PresenceState[] {
  const result: PresenceState[] = [];
  awareness.getStates().forEach((state) => {
    const user = state?.user as PresenceState | undefined;
    if (user && user.userId !== selfId) {
      result.push(user);
    }
  });
  return result;
}
