export type ObjectType = "text" | "shape" | "image" | "sticky" | "audio" | "path";

export type ShapeKind = "rect" | "ellipse" | "triangle";

export type PathPoint = { x: number; y: number };

export type PhysicsConfig = {
  enabled: boolean;
  mass: number;
  frictionAir: number;
  attraction?: number;
};

export type CanvasObject = {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  zIndex: number;
  props: Record<string, unknown>;
  physics?: PhysicsConfig;
  vx?: number;
  vy?: number;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
};

/** Keys of CanvasObject that live as their own field in the CRDT map. */
export const CANVAS_OBJECT_FIELDS = [
  "id",
  "type",
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "width",
  "height",
  "zIndex",
  "physics",
  "vx",
  "vy",
  "createdBy",
  "createdAt",
  "updatedAt",
] as const;

export type HistoryOpType =
  | "create"
  | "update"
  | "delete"
  | "physicsImpulse"
  | "batch";

export type HistoryOp = {
  id: string;
  type: HistoryOpType;
  objectId?: string;
  payload: Record<string, unknown>;
  userId: string;
  username: string;
  timestamp: number;
};

export type GuestIdentity = {
  id: string;
  username: string;
  color: string;
};

export type PresenceState = {
  userId: string;
  username: string;
  color: string;
  cursor: { x: number; y: number } | null;
  viewportCenter: { x: number; y: number };
  viewport: { x: number; y: number; width: number; height: number; zoom: number };
};

export type Tool =
  | "select"
  | "pan"
  | "text"
  | "shape"
  | "sticky"
  | "image"
  | "audio"
  | "physics"
  | "draw";

export const GUEST_COLORS = [
  "#E85D4C",
  "#2BB673",
  "#3B82F6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6",
  "#EF4444",
] as const;

/**
 * `props` is an open bag of unknown values (it has to be: sticky text, shape
 * fill and path points all live there). These accessors narrow on read so
 * callers never stringify an object into "[object Object]" or do arithmetic on
 * a string that arrived from a remote peer.
 */
export function propString(
  props: Record<string, unknown>,
  key: string,
  fallback = ""
): string {
  const value = props[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function propNumber(
  props: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isPathPoint(value: unknown): value is PathPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PathPoint).x === "number" &&
    typeof (value as PathPoint).y === "number"
  );
}

export function propPoints(
  props: Record<string, unknown>,
  key: string
): PathPoint[] {
  const value = props[key];
  return Array.isArray(value) ? value.filter(isPathPoint) : [];
}

/** Reads an array-of-strokes prop, dropping anything malformed. */
export function propStrokes(
  props: Record<string, unknown>,
  key: string
): PathPoint[][] {
  const value = props[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((stroke) => (Array.isArray(stroke) ? stroke.filter(isPathPoint) : []))
    .filter((stroke) => stroke.length > 0);
}

export function createDefaultPhysics(enabled = false): PhysicsConfig {
  return {
    enabled,
    mass: 1,
    frictionAir: 0.02,
    attraction: 0,
  };
}

export function createCanvasObject(
  partial: Partial<CanvasObject> & Pick<CanvasObject, "id" | "type">
): CanvasObject {
  const now = Date.now();
  return {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    width: 160,
    height: 100,
    zIndex: 0,
    props: {},
    physics: createDefaultPhysics(false),
    vx: 0,
    vy: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
