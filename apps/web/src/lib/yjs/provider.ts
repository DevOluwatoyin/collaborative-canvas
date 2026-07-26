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
 * Resolves the WebSocket URL for this page load. A baked-in `localhost` URL
 * breaks collaboration when the app is opened via a LAN IP or hostname — each
 * peer would try to reach *its own* machine instead of the shared collab server.
 */
export function resolveCollabUrl(): string {
  const configured = COLLAB_URL;
  if (typeof window === "undefined") return configured;

  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    const pageIsLoopback =
      pageHost === "localhost" || pageHost === "127.0.0.1" || pageHost === "[::1]";

    if (isLoopback && !pageIsLoopback) {
      url.hostname = pageHost;
      if (window.location.protocol === "https:") url.protocol = "wss:";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

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
  /** Populated asynchronously once the IndexedDB probe succeeds. */
  persistence: IndexeddbPersistence | null;
  /**
   * Resolves with the persistence once storage is confirmed usable, or null
   * when the browser denies IndexedDB (Brave shields, private windows, …).
   */
  whenPersistence: Promise<IndexeddbPersistence | null>;
  objects: YObjects;
  history: Y.Array<HistoryOp>;
  meta: Y.Map<unknown>;
  awareness: Awareness;
};

type PersistenceWithDb = IndexeddbPersistence & {
  _db?: Promise<IDBDatabase>;
};

/**
 * Confirms IndexedDB actually grants access before y-indexeddb touches it.
 * y-indexeddb's constructor chains `.then()` on its open promise with no
 * rejection handler, so a denied open (Brave shields, private windows) always
 * escapes as an unhandled rejection — it cannot be caught after construction.
 * The probe uses the raw event API, which reports denial via a handled event
 * instead of a rejected promise.
 */
function probeIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("orbitboard-idb-probe");
      req.onsuccess = () => {
        req.result.close();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function tryCreatePersistence(
  roomId: string,
  doc: Y.Doc
): Promise<IndexeddbPersistence | null> {
  return probeIndexedDb().then((available) => {
    if (!available) {
      console.warn(
        "[orbitboard] IndexedDB unavailable — continuing without offline cache"
      );
      return null;
    }

    const persistence = new IndexeddbPersistence(
      `room-${roomId}`,
      doc
    ) as PersistenceWithDb;

    // Belt and braces for failures after a successful probe (e.g. quota).
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
  });
}

export function createRoomBindings(
  roomId: string,
  identity: GuestIdentity
): RoomBindings {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(resolveCollabUrl(), roomId, doc, {
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
    draggingIds: [],
    visible:
      typeof document === "undefined" || document.visibilityState === "visible",
  } satisfies PresenceState);

  const bindings: RoomBindings = {
    doc,
    provider,
    persistence: null,
    whenPersistence: Promise.resolve(null),
    objects,
    history,
    meta,
    awareness,
  };

  bindings.whenPersistence = tryCreatePersistence(roomId, doc).then(
    (persistence) => {
      bindings.persistence = persistence;
      return persistence;
    }
  );

  return bindings;
}

export function destroyRoomBindings(bindings: RoomBindings) {
  bindings.awareness.setLocalState(null);
  bindings.provider.destroy();
  // Runs after the creation chain, so a persistence still being probed when
  // the room unmounts is destroyed as soon as it materialises.
  void bindings.whenPersistence
    .then((persistence) => persistence?.destroy())
    .catch(() => undefined);
  bindings.doc.destroy();
}

export function appendHistory(history: Y.Array<HistoryOp>, op: HistoryOp) {
  history.push([op]);
}

/**
 * Force mode and gravity live in the document, not in local UI state: only the
 * elected host runs the simulation, so a setting held locally by a non-host peer
 * would silently do nothing.
 */
export function getForceMode(meta: Y.Map<unknown>): "none" | "attract" | "repel" {
  const mode = meta.get("forceMode");
  return mode === "attract" || mode === "repel" ? mode : "none";
}

export function setForceMode(
  meta: Y.Map<unknown>,
  mode: "none" | "attract" | "repel"
): void {
  meta.set("forceMode", mode);
}

export function getGravity(meta: Y.Map<unknown>): boolean {
  return meta.get("gravity") === true;
}

export function setGravity(meta: Y.Map<unknown>, on: boolean): void {
  meta.set("gravity", on);
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
  _selfUserId?: string
): PresenceState[] {
  const result: PresenceState[] = [];
  const localId = awareness.clientID;
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localId) return;
    const user = state?.user as PresenceState | undefined;
    if (user) result.push({ ...user, clientId });
  });
  return result;
}
