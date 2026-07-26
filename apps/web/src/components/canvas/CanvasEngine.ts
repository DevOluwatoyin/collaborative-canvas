"use client";

import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { CanvasObject, PresenceState, Tool } from "@infinite-canvas/shared";
import { SpatialGrid } from "@/lib/spatial/grid";
import {
  CANVAS_THEME,
  CULL_MARGIN,
  GRID_STEP,
  INTERPOLATION_RATE,
  LOD_ZOOM_THRESHOLD,
  MAX_ZOOM,
  MIN_ZOOM,
  type CanvasThemeMode,
} from "./constants";
import {
  createDisplay,
  ensureImageTexture,
  syncRemoteCursors,
  updateDisplay,
} from "./display";
import {
  screenToWorld,
  selectionBoundsFromIds,
  worldBoundsFromViewport,
  type ObjectLookup,
} from "./geometry";
import { InteractionController } from "./interaction";
import { drawEditHint, drawSelectionHandles, drawWorldGrid } from "./overlayDraw";
import type {
  CanvasEngineCallbacks,
  DisplayEntry,
  Rect,
  RenderTransform,
  ViewportState,
} from "./types";

export type { ViewportState, CanvasEngineCallbacks } from "./types";

/**
 * Renders the canvas from a mutable object map owned by the room, outside React.
 *
 * The previous implementation rebuilt its object cache and re-issued every
 * visible object's draw calls twice per animation frame, so cost scaled with
 * total object count at 60fps regardless of what changed. Now:
 *   - `applyChanges` only touches objects the CRDT actually reported,
 *   - a spatial index answers culling and hit-testing in view-proportional time,
 *   - a display is redrawn only when its object or selection state changed,
 *   - physics-driven objects interpolate toward their last published position so
 *     20Hz network updates still look smooth at 60fps.
 */
export class CanvasEngine {
  app: Application;
  world: Container;
  objectsLayer: Container;
  cursorsLayer: Container;
  overlayLayer: Container;
  viewport: ViewportState = { x: 0, y: 0, zoom: 1 };

  private displays = new Map<string, DisplayEntry>();
  private selectedIds = new Set<string>();
  private tool: Tool = "select";
  private marqueeGfx: Graphics;
  private handlesGfx: Graphics;
  private drawPreviewGfx: Graphics;
  private grid: Graphics;
  private destroyed = false;
  private ready = false;
  private callbacks: CanvasEngineCallbacks;
  private interaction: InteractionController;

  private source: Map<string, CanvasObject> = new Map();
  private overlay: Map<string, CanvasObject> | null = null;
  private index = new SpatialGrid();
  private transforms = new Map<string, RenderTransform>();
  private visible = new Set<string>();
  private viewportDirty = true;
  private selectionDirty = true;
  private cursorZoom = 1;
  private cursor = "default";
  private hintGroup = new Container();
  private hintBg = new Graphics();
  private hintLabel: Text | null = null;
  private editingId: string | null = null;
  private themeMode: CanvasThemeMode = "light";

  /** Stable lookup handed to geometry/overlay helpers. */
  private readonly lookup: ObjectLookup = {
    getObject: (id) => this.activeSource().get(id),
  };

  constructor(callbacks: CanvasEngineCallbacks) {
    this.app = new Application();
    this.world = new Container();
    this.objectsLayer = new Container();
    // Children are drawn in zIndex order rather than insertion order, so object
    // stacking follows the data model.
    this.objectsLayer.sortableChildren = true;
    this.cursorsLayer = new Container();
    this.overlayLayer = new Container();
    this.grid = new Graphics();
    this.marqueeGfx = new Graphics();
    this.handlesGfx = new Graphics();
    this.drawPreviewGfx = new Graphics();
    this.callbacks = callbacks;
    this.interaction = new InteractionController({
      app: this.app,
      viewport: this.viewport,
      callbacks: this.callbacks,
      getTool: () => this.tool,
      getSelectedIds: () => this.selectedIds,
      getObject: (id) => this.activeSource().get(id),
      hitTest: (x, y) => this.hitTest(x, y),
      queryRect: (rect) => this.queryRect(rect),
      isOverlayActive: () => this.overlay !== null,
      setCursor: (cursor) => this.setCursor(cursor),
      screenToWorld: (sx, sy) => this.screenToWorld(sx, sy),
      applyViewport: () => this.applyViewport(),
      redrawGrid: () => this.markViewportDirty(),
      redrawHandles: () => this.markSelectionDirty(),
      getDrawPreviewGfx: () => this.drawPreviewGfx,
      getMarqueeGfx: () => this.marqueeGfx,
    });
  }

  get isReady() {
    return this.ready && !this.destroyed;
  }

  async init(host: HTMLElement, theme: CanvasThemeMode = "light") {
    this.themeMode = theme;
    await this.app.init({
      resizeTo: host,
      background: CANVAS_THEME[theme].background,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.world.addChild(this.grid);
    this.world.addChild(this.objectsLayer);
    this.world.addChild(this.cursorsLayer);
    this.world.addChild(this.overlayLayer);
    this.overlayLayer.addChild(this.marqueeGfx);
    this.overlayLayer.addChild(this.handlesGfx);
    this.overlayLayer.addChild(this.drawPreviewGfx);

    this.hintLabel = new Text({
      text: "Double-click to edit",
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }),
    });
    this.hintGroup.addChild(this.hintBg);
    this.hintGroup.addChild(this.hintLabel);
    this.hintGroup.visible = false;
    this.hintGroup.eventMode = "none";
    this.overlayLayer.addChild(this.hintGroup);
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.ready = true;
    this.interaction.bind();
    this.applyViewport();
    this.markViewportDirty();
  }

  /** Points the engine at the room's live object map. */
  attachSource(objects: Map<string, CanvasObject>) {
    this.source = objects;
    this.reindex();
  }

  setTool(tool: Tool) {
    this.tool = tool;
  }

  setTheme(theme: CanvasThemeMode) {
    if (this.themeMode === theme) return;
    this.themeMode = theme;
    if (!this.ready) return;
    this.app.renderer.background.color = CANVAS_THEME[theme].background;
    this.markViewportDirty();
  }

  setSelectedIds(ids: string[]) {
    this.selectedIds = new Set(ids);
    this.markSelectionDirty();
  }

  setOverlayObjects(objects: CanvasObject[] | null) {
    if (objects === null) {
      if (this.overlay === null) return;
      this.overlay = null;
    } else {
      this.overlay = new Map(objects.map((obj) => [obj.id, obj]));
    }
    this.clearDisplays();
    this.reindex();
  }

  private activeSource(): Map<string, CanvasObject> {
    return this.overlay ?? this.source;
  }

  private clearDisplays() {
    for (const entry of this.displays.values()) {
      this.objectsLayer.removeChild(entry.root);
      entry.root.destroy({ children: true });
    }
    this.displays.clear();
    this.visible.clear();
  }

  private reindex() {
    this.index.clear();
    this.transforms.clear();
    for (const obj of this.activeSource().values()) {
      this.index.upsert(obj);
      this.transforms.set(obj.id, { x: obj.x, y: obj.y, rotation: obj.rotation });
    }
    this.viewportDirty = true;
    this.selectionDirty = true;
  }

  /**
   * Folds the room's pending change queue into the spatial index. Called once
   * per frame with the sets the CRDT observer filled, and drains them.
   */
  applyChanges(dirty: Set<string>, removed: Set<string>) {
    if (this.overlay) {
      // Leave the queues alone — live CRDT updates keep landing in refs while
      // replay is open, and we reindex from the source map when overlay closes.
      return;
    }
    if (removed.size > 0) {
      for (const id of removed) {
        this.index.remove(id);
        this.transforms.delete(id);
        const entry = this.displays.get(id);
        if (entry) {
          this.objectsLayer.removeChild(entry.root);
          entry.root.destroy({ children: true });
          this.displays.delete(id);
        }
        this.visible.delete(id);
        this.selectionDirty = true;
      }
      removed.clear();
    }
    if (dirty.size > 0) {
      for (const id of dirty) {
        const obj = this.source.get(id);
        if (!obj) continue;
        this.index.upsert(obj);
        if (!this.transforms.has(id)) {
          this.transforms.set(id, { x: obj.x, y: obj.y, rotation: obj.rotation });
        }
        if (this.selectedIds.has(id)) this.selectionDirty = true;
      }
      dirty.clear();
    }
  }

  screenToWorld(sx: number, sy: number) {
    return screenToWorld(this.viewport, sx, sy);
  }

  /** Zooms about the viewport centre, as a zoom control is expected to. */
  setZoom(zoom: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    if (next === this.viewport.zoom) return;
    const screenW = this.ready ? this.app.screen.width : 0;
    const screenH = this.ready ? this.app.screen.height : 0;
    const before = this.screenToWorld(screenW / 2, screenH / 2);
    this.viewport.zoom = next;
    this.applyViewport();
    const after = this.screenToWorld(screenW / 2, screenH / 2);
    this.viewport.x += (after.x - before.x) * next;
    this.viewport.y += (after.y - before.y) * next;
    this.applyViewport();
    this.callbacks.onViewportChange({ ...this.viewport });
    this.markViewportDirty();
  }

  /**
   * Centres a world-space rect in the view at the largest zoom that fits it
   * (with breathing room), so "back to my stuff" is one call regardless of how
   * far the user wandered.
   */
  focusWorldRect(rect: Rect) {
    if (!this.ready) return;
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    if (screenW === 0 || screenH === 0) return;
    const worldW = Math.max(1, rect.width);
    const worldH = Math.max(1, rect.height);
    const fitZoom = Math.min((screenW / worldW) * 0.85, (screenH / worldH) * 0.85);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));
    this.viewport.zoom = zoom;
    this.viewport.x = screenW / 2 - (rect.x + rect.width / 2) * zoom;
    this.viewport.y = screenH / 2 - (rect.y + rect.height / 2) * zoom;
    this.applyViewport();
    this.callbacks.onViewportChange({ ...this.viewport });
    this.markViewportDirty();
  }

  getWorldBounds() {
    if (!this.ready || !this.app.screen) {
      return { x: 0, y: 0, width: 800, height: 600, zoom: this.viewport.zoom };
    }
    return worldBoundsFromViewport(
      this.viewport,
      this.app.screen.width,
      this.app.screen.height
    );
  }

  /** Topmost object at a world point, by zIndex. Uses the spatial index. */
  hitTest(wx: number, wy: number): CanvasObject | null {
    const source = this.activeSource();
    let best: CanvasObject | null = null;
    for (const id of this.index.queryPoint(wx, wy)) {
      const obj = source.get(id);
      if (!obj) continue;
      if (!best || obj.zIndex > best.zIndex) best = obj;
    }
    return best;
  }

  queryRect(rect: Rect): string[] {
    return Array.from(this.index.query(rect));
  }

  /**
   * Shows the double-click hint for a single selected object that holds text.
   * Suppressed while that object is already being edited, and for multi-selects
   * where the caption would be ambiguous.
   */
  private redrawEditHint(bounds: Rect | null) {
    const label = this.hintLabel;
    if (!label) return;
    let show = false;
    if (this.selectedIds.size === 1) {
      const [id] = this.selectedIds;
      const obj = this.activeSource().get(id);
      show =
        id !== this.editingId &&
        (obj?.type === "text" || obj?.type === "sticky" || obj?.type === "shape");
    }
    drawEditHint(this.hintGroup, label, this.hintBg, bounds, this.viewport.zoom, show);
  }

  /** Hides the hint for the object currently open in the text editor. */
  setEditingId(id: string | null) {
    if (this.editingId === id) return;
    this.editingId = id;
    this.markSelectionDirty();
  }

  /** Writes the canvas cursor, skipping no-op style writes on every mousemove. */
  setCursor(cursor: string) {
    if (this.cursor === cursor) return;
    this.cursor = cursor;
    if (this.app.canvas) this.app.canvas.style.cursor = cursor;
  }

  markViewportDirty() {
    this.viewportDirty = true;
  }

  markSelectionDirty() {
    this.selectionDirty = true;
  }

  /**
   * Per-frame render pass. Interpolation runs for physics bodies only; static
   * objects snap, so a still canvas costs little beyond the dirty checks.
   */
  render() {
    if (!this.ready) return;
    const source = this.activeSource();
    const bounds = this.getWorldBounds();
    const zoom = this.viewport.zoom;
    const lod = zoom < LOD_ZOOM_THRESHOLD;

    if (this.viewportDirty) {
      drawWorldGrid(this.grid, bounds, zoom, GRID_STEP, CANVAS_THEME[this.themeMode].grid);
    }
    if (zoom !== this.cursorZoom) this.rescaleCursors(zoom);

    const margin = CULL_MARGIN / Math.max(zoom, 0.05);
    const nextVisible = this.index.query({
      x: bounds.x - margin,
      y: bounds.y - margin,
      width: bounds.width + margin * 2,
      height: bounds.height + margin * 2,
    });

    // Hide displays that scrolled out of view; keep them for cheap re-entry.
    for (const id of this.visible) {
      if (nextVisible.has(id)) continue;
      const entry = this.displays.get(id);
      if (entry) entry.root.visible = false;
    }

    for (const id of nextVisible) {
      const obj = source.get(id);
      if (!obj) continue;

      const transform = this.transforms.get(id);
      let rx = obj.x;
      let ry = obj.y;
      let rr = obj.rotation;
      if (transform) {
        if (obj.physics?.enabled && !this.overlay) {
          // Exponential approach to the last published position: cheap, stable,
          // and it never overshoots when updates stall.
          transform.x += (obj.x - transform.x) * INTERPOLATION_RATE;
          transform.y += (obj.y - transform.y) * INTERPOLATION_RATE;
          transform.rotation += (obj.rotation - transform.rotation) * INTERPOLATION_RATE;
        } else {
          transform.x = obj.x;
          transform.y = obj.y;
          transform.rotation = obj.rotation;
        }
        rx = transform.x;
        ry = transform.y;
        rr = transform.rotation;
      }

      let entry = this.displays.get(id);
      if (!entry) {
        entry = createDisplay(obj);
        this.displays.set(id, entry);
        this.objectsLayer.addChild(entry.root);
      }
      entry.root.visible = true;

      // Paint order comes from the object's zIndex, not from insertion order.
      // Without this, "bring to front" and "send to back" changed the data and
      // hit-testing but left the visible stacking untouched.
      if (entry.root.zIndex !== obj.zIndex) entry.root.zIndex = obj.zIndex;

      const selected = this.selectedIds.has(id);
      if (entry.object !== obj || entry.selected !== selected || entry.lod !== lod) {
        updateDisplay(entry, obj, selected, lod, ensureImageTexture);
        entry.object = obj;
        entry.selected = selected;
        entry.lod = lod;
        entry.renderedX = Number.NaN;
      }
      if (
        entry.renderedX !== rx ||
        entry.renderedY !== ry ||
        entry.renderedRotation !== rr
      ) {
        entry.root.position.set(rx + obj.width / 2, ry + obj.height / 2);
        entry.root.rotation = (rr * Math.PI) / 180;
        entry.root.pivot.set(obj.width / 2, obj.height / 2);
        entry.renderedX = rx;
        entry.renderedY = ry;
        entry.renderedRotation = rr;
      }
    }

    this.visible = nextVisible;

    if (this.selectionDirty || this.viewportDirty) {
      this.redrawHandles();
      this.selectionDirty = false;
      this.viewportDirty = false;
    }
  }

  /**
   * Cursors are positioned in world space but must stay a constant on-screen
   * size, so each one is counter-scaled by the current zoom.
   */
  private rescaleCursors(zoom: number) {
    const inverse = 1 / zoom;
    for (const child of this.cursorsLayer.children) child.scale.set(inverse);
    this.cursorZoom = zoom;
  }

  syncCursors(presences: PresenceState[]) {
    if (!this.ready || this.overlay) return;
    syncRemoteCursors(this.cursorsLayer, presences);
    this.rescaleCursors(this.viewport.zoom);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ready = false;
    this.interaction.unbind();
    try {
      if (this.app.renderer) this.app.destroy(true, { children: true });
    } catch {
      // Renderer already torn down.
    }
  }

  private applyViewport() {
    this.world.position.set(this.viewport.x, this.viewport.y);
    this.world.scale.set(this.viewport.zoom);
  }

  private redrawHandles() {
    if (this.overlay) {
      this.handlesGfx.clear();
      this.hintGroup.visible = false;
      return;
    }
    const bounds = selectionBoundsFromIds(this.selectedIds, this.lookup);
    this.redrawEditHint(bounds);
    drawSelectionHandles(
      this.handlesGfx,
      this.selectedIds,
      this.lookup,
      bounds,
      this.viewport.zoom,
      this.selectedIds.size > 1
    );
  }
}
