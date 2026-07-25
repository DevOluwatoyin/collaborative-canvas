"use client";

import {
  createDefaultPhysics,
  type CanvasObject,
  type PathPoint,
  type PresenceState,
  type ShapeKind,
  type Tool,
} from "@infinite-canvas/shared";
import {
  colorPatch,
  fontSizeFor,
  sizePatch,
  strokeWidthFor,
  type SizeName,
} from "@/components/style/styles";
import type { AttractMode, RoomRefs, RoomStore } from "./store";
import type { ObjectStyle } from "./mutations";
import {
  createObjectAt,
  createPathFromStroke,
  deleteRoomObject,
  duplicateRoomObjects,
  flingRoomObject,
  recordUndoDiff,
  reorderRoomObjects,
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

  /** Resolves the panel's style selections into concrete object properties. */
  function currentStyle(): ObjectStyle {
    const { styleColor, styleSize, styleOpacity } = store.getState();
    return {
      color: styleColor,
      fontSize: fontSizeFor(styleSize),
      strokeWidth: strokeWidthFor(styleSize),
      opacity: styleOpacity,
    };
  }

  function createStroke(points: PathPoint[], targetShapeId: string | null) {
    if (!refs.bindings) return;
    const id = createPathFromStroke(
      refs.bindings,
      actor(),
      points,
      targetShapeId,
      currentStyle()
    );
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
      style: currentStyle(),
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

  function duplicateSelected() {
    if (!refs.bindings) return;
    const ids = duplicateRoomObjects(
      refs.bindings,
      actor(),
      store.getState().selectedIds
    );
    if (ids.length > 0) store.setState({ selectedIds: ids });
  }

  function reorderSelected(edge: "front" | "back") {
    if (!refs.bindings) return;
    reorderRoomObjects(refs.bindings, actor(), store.getState().selectedIds, edge);
  }

  /**
   * Style edits apply to the selection when there is one, and always update the
   * stored default so the next created object inherits what the user picked.
   */
  function setStyleColor(hex: string) {
    store.setState({ styleColor: hex });
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of ids) {
        const obj = refs.objects.get(id);
        if (!obj) continue;
        const patch = colorPatch(obj.type, hex);
        if (patch) updateRoomObject(bindings, who, id, { props: patch });
      }
    });
  }

  function setStyleSize(size: SizeName) {
    store.setState({ styleSize: size });
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of ids) {
        const obj = refs.objects.get(id);
        if (!obj) continue;
        const patch = sizePatch(obj.type, size);
        if (patch) updateRoomObject(bindings, who, id, { props: patch });
      }
    });
  }

  function setStyleOpacity(opacity: number, commit = true) {
    store.setState({ styleOpacity: opacity });
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const who = actor();
    bindings.doc.transact(() => {
      // Dragging the slider writes without history; the final value records one
      // op instead of one per pixel of travel.
      for (const id of ids) updateRoomObject(bindings, who, id, { opacity }, commit);
    });
  }

  function undo() {
    const bindings = refs.bindings;
    const manager = refs.undo;
    if (!bindings || !manager || !manager.canUndo()) return;
    const before = new Map(refs.objects);
    manager.undo();
    recordUndoDiff(bindings, actor(), before, refs.objects, "undo");
    pruneSelection();
  }

  function redo() {
    const bindings = refs.bindings;
    const manager = refs.undo;
    if (!bindings || !manager || !manager.canRedo()) return;
    const before = new Map(refs.objects);
    manager.redo();
    recordUndoDiff(bindings, actor(), before, refs.objects, "redo");
    pruneSelection();
  }

  /** Drops ids that an undo/redo removed from the document. */
  function pruneSelection() {
    const { selectedIds } = store.getState();
    const alive = selectedIds.filter((id) => refs.objects.has(id));
    if (alive.length !== selectedIds.length) store.setState({ selectedIds: alive });
  }

  function setZoom(zoom: number) {
    refs.zoomTo?.(zoom);
  }

  function zoomBy(factor: number) {
    setZoom(store.getState().zoom * factor);
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
    duplicateSelected,
    reorderSelected,
    setStyleColor,
    setStyleSize,
    setStyleOpacity,
    undo,
    redo,
    setZoom,
    zoomBy,
  };
}
