import type { CanvasObject } from "@infinite-canvas/shared";
import type { HandleCorner, Point, Rect, ViewportState, WorldBounds } from "./types";
import { MIN_SIZE } from "./constants";

export function screenToWorld(viewport: ViewportState, sx: number, sy: number): Point {
  return {
    x: (sx - viewport.x) / viewport.zoom,
    y: (sy - viewport.y) / viewport.zoom,
  };
}

export function worldBoundsFromViewport(
  viewport: ViewportState,
  screenW: number,
  screenH: number
): WorldBounds {
  const topLeft = screenToWorld(viewport, 0, 0);
  const bottomRight = screenToWorld(viewport, screenW, screenH);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
    zoom: viewport.zoom,
  };
}

export function objectsBoundingBox(
  objects: Iterable<Pick<CanvasObject, "x" | "y" | "width" | "height">>,
  pad = 0
): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const o of objects) {
    count += 1;
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  if (!count) return null;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/** Lookup indirection so callers can read from a Map or from the live engine. */
export type ObjectLookup = { getObject: (id: string) => CanvasObject | undefined };

export function lookupFromMap(map: Map<string, CanvasObject>): ObjectLookup {
  return { getObject: (id) => map.get(id) };
}

export function selectionBoundsFromIds(
  selectedIds: Iterable<string>,
  lookup: ObjectLookup
): Rect | null {
  const objs: CanvasObject[] = [];
  for (const id of selectedIds) {
    const o = lookup.getObject(id);
    if (o) objs.push(o);
  }
  return objectsBoundingBox(objs);
}

export function handlePositions(bounds: Rect): { corner: HandleCorner; x: number; y: number }[] {
  const { x, y, width: w, height: h } = bounds;
  return [
    { corner: "nw", x, y },
    { corner: "ne", x: x + w, y },
    { corner: "sw", x, y: y + h },
    { corner: "se", x: x + w, y: y + h },
    { corner: "n", x: x + w / 2, y },
    { corner: "s", x: x + w / 2, y: y + h },
    { corner: "w", x, y: y + h / 2 },
    { corner: "e", x: x + w, y: y + h / 2 },
  ];
}

/**
 * CSS cursor for each resize handle, so the pointer advertises the gesture
 * before the user commits to a drag.
 */
const HANDLE_CURSOR: Record<HandleCorner, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export function cursorForHandle(corner: HandleCorner): string {
  return HANDLE_CURSOR[corner];
}

export function hitHandleAt(
  bounds: Rect | null,
  wx: number,
  wy: number,
  hitPad: number
): { corner: HandleCorner } | null {
  if (!bounds) return null;
  for (const h of handlePositions(bounds)) {
    if (
      wx >= h.x - hitPad &&
      wx <= h.x + hitPad &&
      wy >= h.y - hitPad &&
      wy <= h.y + hitPad
    ) {
      return { corner: h.corner };
    }
  }
  return null;
}

/** Compute resized group rect + per-object transforms from a handle drag. */
export function computeGroupResize(
  corner: HandleCorner,
  startBounds: Rect,
  startWorld: Point,
  world: Point,
  origins: Map<string, Rect>
): { id: string; x: number; y: number; width: number; height: number }[] {
  const dx = world.x - startWorld.x;
  const dy = world.y - startWorld.y;
  let { x, y, width, height } = startBounds;
  if (corner.includes("e")) width = Math.max(MIN_SIZE, startBounds.width + dx);
  if (corner.includes("w")) {
    width = Math.max(MIN_SIZE, startBounds.width - dx);
    x = startBounds.x + startBounds.width - width;
  }
  if (corner.includes("s")) height = Math.max(MIN_SIZE, startBounds.height + dy);
  if (corner.includes("n")) {
    height = Math.max(MIN_SIZE, startBounds.height - dy);
    y = startBounds.y + startBounds.height - height;
  }
  const sx = width / startBounds.width;
  const sy = height / startBounds.height;
  const updates: { id: string; x: number; y: number; width: number; height: number }[] = [];
  for (const [id, origin] of origins) {
    updates.push({
      id,
      x: x + (origin.x - startBounds.x) * sx,
      y: y + (origin.y - startBounds.y) * sy,
      width: Math.max(MIN_SIZE, origin.width * sx),
      height: Math.max(MIN_SIZE, origin.height * sy),
    });
  }
  return updates;
}

/** Normalises a drag rectangle so width/height are always positive. */
export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

/** Screen-space offset of the rotation grip above the selection's top edge. */
export const ROTATE_HANDLE_OFFSET = 26;

export function rotateHandlePosition(bounds: Rect, zoom: number): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y - ROTATE_HANDLE_OFFSET / zoom,
  };
}

export function hitRotateHandle(
  bounds: Rect | null,
  wx: number,
  wy: number,
  zoom: number,
  hitPad: number
): boolean {
  if (!bounds) return false;
  const grip = rotateHandlePosition(bounds, zoom);
  return Math.hypot(wx - grip.x, wy - grip.y) <= hitPad;
}

/** Degrees from a centre to a point, measured clockwise from 12 o'clock. */
export function angleFromCenter(center: Point, point: Point): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

/**
 * Rotates each object about the selection centre. A single object spins in
 * place; a group also orbits, so the arrangement rotates as one rigid body.
 */
export function computeRotation(
  state: {
    center: Point;
    startAngle: number;
    origins: Map<string, { rotation: number; cx: number; cy: number }>;
  },
  world: Point,
  snap: boolean
): { id: string; rotation: number; cx: number; cy: number }[] {
  let delta = angleFromCenter(state.center, world) - state.startAngle;
  if (snap) delta = Math.round(delta / 15) * 15;
  const radians = (delta * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const updates: { id: string; rotation: number; cx: number; cy: number }[] = [];
  for (const [id, origin] of state.origins) {
    const dx = origin.cx - state.center.x;
    const dy = origin.cy - state.center.y;
    updates.push({
      id,
      rotation: normalizeDegrees(origin.rotation + delta),
      cx: state.center.x + dx * cos - dy * sin,
      cy: state.center.y + dx * sin + dy * cos,
    });
  }
  return updates;
}

export function normalizeDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
