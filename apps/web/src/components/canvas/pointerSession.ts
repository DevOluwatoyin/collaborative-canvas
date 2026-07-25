import type { HandleCorner, Point, Rect } from "./types";

export type DragState = {
  ids: string[];
  origins: Map<string, Point>;
  startWorld: Point;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
};

export type ResizeState = {
  corner: HandleCorner;
  startBounds: Rect;
  startWorld: Point;
  origins: Map<string, Rect>;
};

export type DrawState = {
  points: Point[];
  targetShapeId: string | null;
};

export type MarqueeState = { x0: number; y0: number; x1: number; y1: number };

export type PointerSession = {
  panning: boolean;
  panStart: { x: number; y: number; vx: number; vy: number };
  dragging: DragState | null;
  resizing: ResizeState | null;
  drawing: DrawState | null;
  marquee: MarqueeState | null;
  spaceDown: boolean;
  lastClick: { id: string | null; t: number };
};

export function createPointerSession(): PointerSession {
  return {
    panning: false,
    panStart: { x: 0, y: 0, vx: 0, vy: 0 },
    dragging: null,
    resizing: null,
    drawing: null,
    marquee: null,
    spaceDown: false,
    lastClick: { id: null, t: 0 },
  };
}
