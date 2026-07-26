import type { HandleCorner, Point, Rect } from "./types";

type DragState = {
  ids: string[];
  origins: Map<string, Point>;
  startWorld: Point;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
};

type ResizeState = {
  corner: HandleCorner;
  startBounds: Rect;
  startWorld: Point;
  origins: Map<string, Rect>;
};

type DrawState = {
  points: Point[];
  targetShapeId: string | null;
};

/** Free rotation about the centre of the selection bounds. */
type RotateState = {
  center: Point;
  /** Pointer angle when the gesture began, in degrees. */
  startAngle: number;
  origins: Map<string, { rotation: number; cx: number; cy: number }>;
};

type MarqueeState = { x0: number; y0: number; x1: number; y1: number };

export type PointerSession = {
  panning: boolean;
  panStart: { x: number; y: number; vx: number; vy: number };
  dragging: DragState | null;
  resizing: ResizeState | null;
  rotating: RotateState | null;
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
    rotating: null,
    drawing: null,
    marquee: null,
    spaceDown: false,
    lastClick: { id: null, t: 0 },
  };
}
