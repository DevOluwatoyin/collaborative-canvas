"use client";

import { nanoid } from "nanoid";
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
import {
  setForceMode,
  setGravity as setGravityMeta,
} from "@/lib/yjs/provider";
import { selectedObjects } from "./store";
import type { AttractMode, RoomRefs, RoomStore } from "./store";
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
  pasteRoomObjects,
  recordUndoDiff,
  reorderRoomObjects,
  spawnBulkObjects,
  updateRoomObject,
} from "./mutations";

/** Marks clipboard text as ours, so pasting foreign text is ignored. */
const CLIPBOARD_KIND = "orbitboard/objects";

/** Awareness is throttled to ~16Hz; cursors do not need a frame-accurate feed. */
const PRESENCE_INTERVAL_MS = 60;

export type RoomActions = ReturnType<typeof createRoomActions>;

/**
 * Actions are built once per room, outside React. Previously every action was a
 * useCallback in the provider, so the context value changed identity on each
 * render and pushed a re-render through every consumer.
 */
export function createRoomActions(store: RoomStore, refs: RoomRefs) {
  /** Fallback for browsers that block clipboard access from canvas events. */
  let internalClipboard: CanvasObject[] = [];

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

  /**
   * Written to the document rather than to local state: only the elected host
   * simulates, so a force mode held by a non-host peer would do nothing.
   */
  function setAttractMode(attractMode: AttractMode) {
    if (!refs.bindings) return;
    setForceMode(refs.bindings.meta, attractMode);
  }

  function setGravityEnabled(on: boolean) {
    if (!refs.bindings) return;
    setGravityMeta(refs.bindings.meta, on);
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
    const picked = pickFile("image/*");
    void (async () => {
      const file = await picked;
      if (!file) return;
      const id = await createImageObject(bindings, actor(), world, file);
      store.setState({ selectedIds: [id], tool: "select" });
    })();
  }

  /** Same immediacy for audio: pressing the mic opens the recorder at once. */
  function startAudioAtCenter() {
    if (!refs.bindings) return;
    const world = centerOfView();
    store.setState({ audioCapture: { id: nanoid(8), x: world.x, y: world.y } });
  }

  /**
   * Objects are copied as JSON text so a copy can cross tabs and windows. The
   * in-memory buffer is the fallback for browsers that refuse clipboard writes
   * without a user-activation the canvas cannot always provide.
   */
  async function copySelection(cut = false): Promise<number> {
    const objects = selectedObjects(refs, store.getState().selectedIds);
    if (objects.length === 0) return 0;
    const payload = JSON.stringify({ type: CLIPBOARD_KIND, objects });
    internalClipboard = objects;
    try {
      await navigator.clipboard?.writeText(payload);
    } catch {
      // System clipboard unavailable; the internal buffer still serves paste.
    }
    if (cut) removeSelected();
    return objects.length;
  }

  async function readClipboardObjects(): Promise<CanvasObject[]> {
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
      // Clipboard read denied or holds something else; fall back below.
    }
    return internalClipboard;
  }

  async function pasteClipboard() {
    const bindings = refs.bindings;
    if (!bindings) return;
    const objects = await readClipboardObjects();
    if (objects.length === 0) return;
    const ids = pasteRoomObjects(bindings, actor(), objects);
    if (ids.length > 0) store.setState({ selectedIds: ids, tool: "select" });
  }

  function cancelAudioCapture() {
    store.setState({ audioCapture: null });
  }

  async function commitAudioCapture(blob: Blob, durationMs: number) {
    const bindings = refs.bindings;
    const target = store.getState().audioCapture;
    store.setState({ audioCapture: null });
    if (!bindings || !target) return;
    const id = await createAudioObject(bindings, actor(), target, blob, durationMs);
    store.setState({ selectedIds: [id], tool: "select" });
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

  /** Applies to the selection when there is one, otherwise sets the default. */
  function setCornerRadius(radius: number, commit = true) {
    store.setState({ styleCornerRadius: radius });
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of ids) {
        const obj = refs.objects.get(id);
        if (
          !obj ||
          (obj.type !== "shape" && obj.type !== "sticky" && obj.type !== "image")
        ) {
          continue;
        }
        updateRoomObject(bindings, who, id, { props: { cornerRadius: radius } }, commit);
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
    setGravityEnabled,
    togglePhysicsOnSelected,
    updateObject,
    removeObject,
    removeSelected,
    selectAll,
    createStroke,
    createAt,
    insertImage,
    startAudioAtCenter,
    copySelection,
    pasteClipboard,
    cancelAudioCapture,
    commitAudioCapture,
    flingObject,
    spawnBulk,
    updatePresence,
    duplicateSelected,
    reorderSelected,
    setStyleColor,
    setStyleSize,
    setStyleOpacity,
    setCornerRadius,
    undo,
    redo,
    setZoom,
    zoomBy,
    zoomToFit,
  };
}
