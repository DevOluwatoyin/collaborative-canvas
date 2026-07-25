"use client";

import {
  createDefaultPhysics,
  type CanvasObject,
  type PathPoint,
  type PresenceState,
  type ShapeKind,
  type Tool,
} from "@infinite-canvas/shared";
import type { AttractMode, RoomRefs, RoomStore } from "./store";
import {
  createObjectAt,
  createPathFromStroke,
  deleteRoomObject,
  flingRoomObject,
  spawnBulkObjects,
  updateRoomObject,
} from "./mutations";

/** Awareness is throttled to ~16Hz; cursors do not need a frame-accurate feed. */
const PRESENCE_INTERVAL_MS = 60;

export type RoomActions = ReturnType<typeof createRoomActions>;

/**
 * Actions are built once per room, outside React. Previously every action was a
 * useCallback in the provider, so the context value changed identity on each
 * render and pushed a re-render through every consumer.
 */
export function createRoomActions(store: RoomStore, refs: RoomRefs) {
  const actor = () => {
    const { identity } = store.getState();
    return { id: identity.id, username: identity.username };
  };

  let presenceAt = 0;
  let presencePending: Partial<PresenceState> | null = null;

  function setTool(tool: Tool) {
    store.setState({ tool });
  }

  function setShapeKind(shapeKind: ShapeKind) {
    store.setState({ shapeKind });
  }

  function setSelectedIds(ids: string[]) {
    store.setState({ selectedIds: ids });
  }

  function setSelectedId(id: string | null) {
    store.setState({ selectedIds: id ? [id] : [] });
  }

  function addToSelection(ids: string[]) {
    const current = store.getState().selectedIds;
    const merged = new Set(current);
    for (const id of ids) merged.add(id);
    store.setState({ selectedIds: Array.from(merged) });
  }

  function setEditingTextId(editingTextId: string | null) {
    store.setState({ editingTextId });
  }

  function setReplayObjects(replayObjects: CanvasObject[] | null) {
    store.setState({ replayObjects });
  }

  function setAttractMode(attractMode: AttractMode) {
    store.setState({ attractMode });
    refs.physics?.setAttractMode(attractMode);
  }

  function updateObject(
    id: string,
    patch: Partial<CanvasObject>,
    recordHistory = true
  ) {
    if (!refs.bindings) return;
    updateRoomObject(refs.bindings, actor(), id, patch, recordHistory);
  }

  function removeObject(id: string) {
    if (!refs.bindings) return;
    deleteRoomObject(refs.bindings, actor(), id);
    const remaining = store.getState().selectedIds.filter((x) => x !== id);
    store.setState({ selectedIds: remaining });
  }

  function removeSelected() {
    if (!refs.bindings) return;
    const { selectedIds } = store.getState();
    const bindings = refs.bindings;
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of selectedIds) deleteRoomObject(bindings, who, id);
    });
    store.setState({ selectedIds: [] });
  }

  function selectAll() {
    store.setState({ selectedIds: Array.from(refs.objects.keys()), tool: "select" });
  }

  function createStroke(points: PathPoint[], targetShapeId: string | null) {
    if (!refs.bindings) return;
    const id = createPathFromStroke(refs.bindings, actor(), points, targetShapeId);
    if (id && !targetShapeId) store.setState({ selectedIds: [id] });
  }

  async function createAt(
    world: PathPoint,
    opts?: { forceType?: CanvasObject["type"]; hitId?: string | null }
  ) {
    if (!refs.bindings) return;
    const { tool, shapeKind } = store.getState();
    const result = await createObjectAt(refs.bindings, actor(), world, {
      tool,
      shapeKind,
      forceType: opts?.forceType,
      hitId: opts?.hitId,
    });
    if (!result) return;
    store.setState({ selectedIds: [result.id] });
    if (result.openEditor) store.setState({ editingTextId: result.id });
    if (result.switchToSelect) store.setState({ tool: "select" });
  }

  function flingObject(id: string, vx: number, vy: number) {
    if (!refs.bindings) return;
    flingRoomObject(refs.bindings, refs.physics, actor(), id, vx, vy);
  }

  function enablePhysicsOnSelected() {
    if (!refs.bindings) return;
    const { selectedIds } = store.getState();
    const bindings = refs.bindings;
    bindings.doc.transact(() => {
      for (const id of selectedIds) {
        updateObject(id, { physics: createDefaultPhysics(true) });
      }
    });
  }

  function spawnBulk(count: number) {
    if (!refs.bindings) return;
    spawnBulkObjects(refs.bindings, actor(), count);
  }

  /**
   * Coalesces presence writes: the newest partial always wins and is flushed at
   * most every PRESENCE_INTERVAL_MS.
   */
  function updatePresence(partial: Partial<PresenceState>) {
    const bindings = refs.bindings;
    if (!bindings) return;
    presencePending = { ...(presencePending ?? {}), ...partial };
    const now = performance.now();
    if (now - presenceAt < PRESENCE_INTERVAL_MS) return;
    presenceAt = now;
    const merged = presencePending;
    presencePending = null;
    const { identity } = store.getState();
    const current =
      (bindings.awareness.getLocalState()?.user as PresenceState | undefined) ?? {
        userId: identity.id,
        username: identity.username,
        color: identity.color,
        cursor: null,
        viewportCenter: { x: 0, y: 0 },
        viewport: { x: 0, y: 0, width: 800, height: 600, zoom: 1 },
      };
    bindings.awareness.setLocalStateField("user", { ...current, ...merged });
  }

  return {
    setTool,
    setShapeKind,
    setSelectedIds,
    setSelectedId,
    addToSelection,
    setEditingTextId,
    setReplayObjects,
    setAttractMode,
    updateObject,
    removeObject,
    removeSelected,
    selectAll,
    createStroke,
    createAt,
    flingObject,
    enablePhysicsOnSelected,
    spawnBulk,
    updatePresence,
  };
}
