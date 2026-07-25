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
};

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
    ...partial,
  };
}
