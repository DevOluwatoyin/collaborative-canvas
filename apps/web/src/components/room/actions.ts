"use client";

import { nanoid } from "nanoid";
import {
  createDefaultPhysics,
  MEDIA_IMAGE_ACCEPT,
  validateMediaFile,
  type CanvasObject,
  type PathPoint,
  type ShapeKind,
  type Tool,
} from "@infinite-canvas/shared";
import { fontSizeFor, strokeWidthFor } from "@/components/style/styles";
import { createClipboardActions } from "./actions/clipboard";
import { createPresenceActions } from "./actions/presence";
import { createStyleActions } from "./actions/style";
import type { RoomRefs, RoomStore } from "./store";
import type { ObjectStyle } from "./mutations";
import { pickFile } from "./media";
import {
  createAudioObject,
  createImageObject,
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

  const presence = createPresenceActions(store, refs);
  const style = createStyleActions(store, refs, actor);

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

  /** Raises a transient message. A fresh id restarts the auto-dismiss timer. */
  function notify(message: string, tone: "error" | "info" = "error") {
    store.setState({ notice: { id: nanoid(6), tone, message } });
  }

  function dismissNotice() {
    store.setState({ notice: null });
  }

  function setReplayObjects(replayObjects: CanvasObject[] | null) {
    store.setState({ replayObjects });
  }


  /** Turns physics on for the selection, or off if all of it is already on. */
  function togglePhysicsOnSelected() {
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const allEnabled = ids.every((id) => refs.objects.get(id)?.physics?.enabled);
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of ids) {
        updateRoomObject(bindings, who, id, {
          physics: createDefaultPhysics(!allEnabled),
          vx: 0,
          vy: 0,
        });
      }
    });
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

  function createAt(
    world: PathPoint,
    opts?: { forceType?: CanvasObject["type"]; hitId?: string | null }
  ) {
    if (!refs.bindings) return;
    const { tool, shapeKind } = store.getState();

    // Audio needs an interactive capture step, so placing it opens the recorder
    // rather than creating an object immediately.
    if ((opts?.forceType ?? (tool === "audio" ? "audio" : null)) === "audio") {
      store.setState({
        audioCapture: { id: nanoid(8), x: world.x, y: world.y },
      });
      return;
    }

    const result = createObjectAt(refs.bindings, actor(), world, {
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

  function centerOfView(): PathPoint {
    return refs.viewportCenter?.() ?? { x: 0, y: 0 };
  }

  /**
   * Opens the file picker straight from the toolbar click and drops the image in
   * the middle of the view.
   *
   * Requiring a second click on the canvas to choose a position meant the icon
   * looked dead on press, and the picker could only ever be triggered by that
   * follow-up click. `pickFile` must be reached synchronously from the click
   * handler — awaiting anything first spends the user activation the browser
   * requires to open a file dialog.
   */
  function insertImage() {
    const bindings = refs.bindings;
    if (!bindings) return;
    const world = centerOfView();
    const picked = pickFile(MEDIA_IMAGE_ACCEPT);
    void (async () => {
      const file = await picked;
      if (!file) return;

      // The accept attribute is only a hint — a user can pick any file through
      // "All files", and drag-and-drop bypasses it entirely.
      const check = validateMediaFile(file, "image");
      if (!check.ok) {
        notify(check.message);
        return;
      }

      const result = await createImageObject(bindings, actor(), world, file);
      if (!result.ok) {
        notify(result.message);
        return;
      }
      store.setState({ selectedIds: [result.id], tool: "select" });
    })();
  }

  /** Same immediacy for audio: pressing the mic opens the recorder at once. */
  function startAudioAtCenter() {
    if (!refs.bindings) return;
    const world = centerOfView();
    store.setState({ audioCapture: { id: nanoid(8), x: world.x, y: world.y } });
  }


  function cancelAudioCapture() {
    store.setState({ audioCapture: null });
  }

  async function commitAudioCapture(blob: Blob, durationMs: number) {
    const bindings = refs.bindings;
    const target = store.getState().audioCapture;
    store.setState({ audioCapture: null });
    if (!bindings || !target) return;

    const check = validateMediaFile(blob, "audio");
    if (!check.ok) {
      notify(check.message);
      return;
    }

    const result = await createAudioObject(bindings, actor(), target, blob, durationMs);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    store.setState({ selectedIds: [result.id], tool: "select" });
  }

  function flingObject(id: string, vx: number, vy: number) {
    if (!refs.bindings) return;
    flingRoomObject(refs.bindings, refs.physics, actor(), id, vx, vy);
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
   * Frames every object on the board — the way back after zooming or panning
   * into empty space far from the content.
   */
  function zoomToFit() {
    if (refs.objects.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const o of refs.objects.values()) {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.width);
      maxY = Math.max(maxY, o.y + o.height);
    }
    refs.focusRect?.({
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    });
  }


  const clipboard = createClipboardActions(store, refs, actor, removeSelected);

  return {
    ...presence,
    ...style,
    ...clipboard,
    setTool,
    setShapeKind,
    setSelectedIds,
    setSelectedId,
    addToSelection,
    setEditingTextId,
    setReplayObjects,
    togglePhysicsOnSelected,
    updateObject,
    removeObject,
    removeSelected,
    selectAll,
    createStroke,
    createAt,
    insertImage,
    startAudioAtCenter,
    cancelAudioCapture,
    commitAudioCapture,
    flingObject,
    spawnBulk,
    notify,
    dismissNotice,
    duplicateSelected,
    reorderSelected,
    undo,
    redo,
    setZoom,
    zoomBy,
    zoomToFit,
  };
}
