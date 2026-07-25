"use client";

import { createStore } from "zustand/vanilla";
import type {
  CanvasObject,
  GuestIdentity,
  HistoryOp,
  PresenceState,
  ShapeKind,
  Tool,
} from "@infinite-canvas/shared";
import type * as Y from "yjs";
import type { RoomBindings } from "@/lib/yjs/provider";
import type { PhysicsBridge } from "@/lib/physics/engine";
import type { SizeName } from "@/components/style/styles";

export type AttractMode = "none" | "attract" | "repel";

/** Set as the transaction origin for simulation writes; see RoomRefs.undo. */
export const PHYSICS_ORIGIN = "physics";

/**
 * React-visible room state. Deliberately excludes the canvas objects: physics
 * writes positions ~20 times a second, and putting that feed through React
 * meant re-rendering every consumer of the room context at that rate. Objects
 * live in RoomRefs.objects (a plain mutable Map the renderer reads directly) and
 * React only sees `revision`, bumped on a throttle for panels that display
 * object data.
 */
export type RoomState = {
  roomId: string;
  identity: GuestIdentity;

  revision: number;
  objectCount: number;

  history: HistoryOp[];
  historyBase: CanvasObject[];
  historyBaseCount: number;
  remotes: PresenceState[];

  connected: boolean;
  online: boolean;
  synced: boolean;
  /** Elected simulation owner: runs physics and compacts the op log. */
  isHost: boolean;

  tool: Tool;
  shapeKind: ShapeKind;
  selectedIds: string[];
  editingTextId: string | null;
  attractMode: AttractMode;

  /**
   * Style the panel edits. With a selection it mirrors the first selected
   * object; with nothing selected it is the style newly created objects inherit.
   */
  styleColor: string;
  styleSize: SizeName;
  styleOpacity: number;

  /** Mirrors the canvas zoom so the zoom control can display and drive it. */
  zoom: number;

  canUndo: boolean;
  canRedo: boolean;

  /** When non-null the canvas renders this snapshot instead of live state. */
  replayObjects: CanvasObject[] | null;
};

/**
 * Mutable, non-reactive room infrastructure. `objects` is the authoritative
 * materialised view of the CRDT; `dirty`/`removed` are the pending change queue
 * the renderer drains each frame so it only touches what actually moved.
 */
export type RoomRefs = {
  bindings: RoomBindings | null;
  physics: PhysicsBridge | null;
  /**
   * Scoped to the objects map and to local transactions only, so undo never
   * reverts a collaborator's edit and never walks back a physics tick.
   */
  undo: Y.UndoManager | null;
  /** Set by the canvas so zoom controls can drive the viewport imperatively. */
  zoomTo: ((zoom: number) => void) | null;
  objects: Map<string, CanvasObject>;
  dirty: Set<string>;
  removed: Set<string>;
  /**
   * Ids with physics enabled, maintained incrementally. The simulation loop
   * iterates this instead of every object, so simulation cost tracks the number
   * of active bodies rather than the size of the canvas.
   */
  physicsIds: Set<string>;
};

export type RoomStore = ReturnType<typeof createRoomStore>;

export function createRoomStore(roomId: string, identity: GuestIdentity) {
  return createStore<RoomState>()(() => ({
    roomId,
    identity,
    revision: 0,
    objectCount: 0,
    history: [],
    historyBase: [],
    historyBaseCount: 0,
    remotes: [],
    connected: false,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    synced: false,
    isHost: false,
    tool: "select",
    shapeKind: "rect",
    selectedIds: [],
    editingTextId: null,
    attractMode: "none",
    styleColor: "#4465e9",
    styleSize: "m",
    styleOpacity: 1,
    zoom: 1,
    canUndo: false,
    canRedo: false,
    replayObjects: null,
  }));
}

export function createRoomRefs(): RoomRefs {
  return {
    bindings: null,
    physics: null,
    undo: null,
    zoomTo: null,
    objects: new Map(),
    dirty: new Set(),
    removed: new Set(),
    physicsIds: new Set(),
  };
}

/**
 * RoomRefs is deliberately mutable, and these writers live at module scope so
 * the mutation never happens inside a component body — React's immutability
 * lint rule (rightly) rejects assigning through a value obtained from state or
 * context, even when that value is an intentional escape hatch.
 */
export function attachRoomInfra(
  refs: RoomRefs,
  bindings: RoomBindings,
  physics: PhysicsBridge,
  undo: Y.UndoManager
): void {
  refs.bindings = bindings;
  refs.physics = physics;
  refs.undo = undo;
}

export function setZoomHandle(
  refs: RoomRefs,
  zoomTo: ((zoom: number) => void) | null
): void {
  refs.zoomTo = zoomTo;
}

export function detachRoomInfra(refs: RoomRefs): void {
  refs.bindings = null;
  refs.physics = null;
  refs.undo = null;
  refs.objects.clear();
  refs.dirty.clear();
  refs.removed.clear();
  refs.physicsIds.clear();
}

/** Records a created or updated object and flags it for the renderer. */
export function stageObject(refs: RoomRefs, obj: CanvasObject): void {
  refs.objects.set(obj.id, obj);
  if (obj.physics?.enabled) refs.physicsIds.add(obj.id);
  else refs.physicsIds.delete(obj.id);
  refs.removed.delete(obj.id);
  refs.dirty.add(obj.id);
}

export function stageRemoval(refs: RoomRefs, id: string): void {
  refs.objects.delete(id);
  refs.physicsIds.delete(id);
  refs.dirty.delete(id);
  refs.removed.add(id);
}

export function resetObjects(refs: RoomRefs): void {
  refs.objects.clear();
  refs.physicsIds.clear();
}

export function allObjects(refs: RoomRefs): CanvasObject[] {
  return Array.from(refs.objects.values());
}

/**
 * Stable subscribe function for useSyncExternalStore. Created once per room so
 * the hook does not resubscribe on every render.
 */
export function createStoreSubscriber(store: RoomStore) {
  return (onChange: () => void) => store.subscribe(onChange);
}

const EMPTY_OBJECTS: CanvasObject[] = [];

/**
 * Readers materialise the mutable object map into a value that is stable until
 * `revision` changes. useSyncExternalStore requires a snapshot getter that does
 * not allocate on every call, and the cache lives in a closure so no component
 * ever mutates through a state- or context-held value.
 */
export function createObjectsReader(refs: RoomRefs) {
  let cachedRevision = -1;
  let cached: CanvasObject[] = EMPTY_OBJECTS;
  return {
    read: (revision: number): CanvasObject[] => {
      if (revision !== cachedRevision) {
        cachedRevision = revision;
        cached = Array.from(refs.objects.values());
      }
      return cached;
    },
    server: (): CanvasObject[] => EMPTY_OBJECTS,
  };
}

export function createObjectReader(refs: RoomRefs) {
  let cachedKey = "";
  let cached: CanvasObject | null = null;
  return {
    read: (revision: number, id: string | null): CanvasObject | null => {
      const key = `${revision}:${id ?? ""}`;
      if (key !== cachedKey) {
        cachedKey = key;
        cached = id ? refs.objects.get(id) ?? null : null;
      }
      return cached;
    },
    server: (): CanvasObject | null => null,
  };
}

export function selectedObjects(refs: RoomRefs, ids: readonly string[]): CanvasObject[] {
  const out: CanvasObject[] = [];
  for (const id of ids) {
    const obj = refs.objects.get(id);
    if (obj) out.push(obj);
  }
  return out;
}
