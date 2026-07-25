import {
  createCanvasObject,
  propNumber,
  type CanvasObject,
  type HistoryOp,
} from "@infinite-canvas/shared";
import { nanoid } from "nanoid";

function cloneInto(base: readonly CanvasObject[]): Map<string, CanvasObject> {
  const map = new Map<string, CanvasObject>();
  for (const obj of base) map.set(obj.id, { ...obj, props: { ...obj.props } });
  return map;
}

function applyOp(map: Map<string, CanvasObject>, op: HistoryOp): void {
  switch (op.type) {
    case "create": {
      const obj = op.payload.object as CanvasObject | undefined;
      if (obj?.id) map.set(obj.id, { ...obj, props: { ...obj.props } });
      break;
    }
    case "update": {
      const id = op.objectId ?? (op.payload.id as string | undefined);
      const current = id ? map.get(id) : undefined;
      if (!id || !current || !op.payload.patch) break;
      const patch = op.payload.patch as Partial<CanvasObject>;
      map.set(id, {
        ...current,
        ...patch,
        props: { ...current.props, ...(patch.props ?? {}) },
      });
      break;
    }
    case "delete": {
      const id = op.objectId ?? (op.payload.id as string | undefined);
      if (id) map.delete(id);
      break;
    }
    case "physicsImpulse": {
      const id = op.objectId;
      const current = id ? map.get(id) : undefined;
      if (!id || !current) break;
      map.set(id, {
        ...current,
        vx: propNumber(op.payload, "vx", 0),
        vy: propNumber(op.payload, "vy", 0),
        x: propNumber(op.payload, "x", current.x),
        y: propNumber(op.payload, "y", current.y),
      });
      break;
    }
    case "batch": {
      const items = Array.isArray(op.payload.ops)
        ? (op.payload.ops as HistoryOp[])
        : [];
      for (const nested of items) applyOp(map, nested);
      break;
    }
  }
}

/**
 * Folds ops onto a base snapshot and returns the resulting object list. Used to
 * compact the head of the op log without losing the state those ops produced.
 */
export function foldOps(
  ops: readonly HistoryOp[],
  base: readonly CanvasObject[] = []
): CanvasObject[] {
  const map = cloneInto(base);
  for (const op of ops) applyOp(map, op);
  return Array.from(map.values());
}

/**
 * Rebuilds canvas state as of `step`, where step 0 is the base snapshot (the
 * session start, or the compacted prefix) and step N is the state after
 * `ops[N - 1]` has been applied.
 */
export function replayToStep(
  ops: readonly HistoryOp[],
  step: number,
  base: readonly CanvasObject[] = []
): CanvasObject[] {
  const map = cloneInto(base);
  const end = Math.max(0, Math.min(step, ops.length));
  for (let i = 0; i < end; i++) {
    const op = ops[i];
    if (op) applyOp(map, op);
  }
  return Array.from(map.values());
}

function newOpId(): string {
  return `h-${nanoid(10)}`;
}

export function historyOpFromCreate(
  obj: CanvasObject,
  userId: string,
  username: string
): HistoryOp {
  return {
    id: newOpId(),
    type: "create",
    objectId: obj.id,
    payload: { object: obj },
    userId,
    username,
    timestamp: Date.now(),
  };
}

export function historyOpFromUpdate(
  objectId: string,
  patch: Partial<CanvasObject>,
  userId: string,
  username: string
): HistoryOp {
  return {
    id: newOpId(),
    type: "update",
    objectId,
    payload: { patch },
    userId,
    username,
    timestamp: Date.now(),
  };
}

export function historyOpFromDelete(
  objectId: string,
  userId: string,
  username: string
): HistoryOp {
  return {
    id: newOpId(),
    type: "delete",
    objectId,
    payload: { id: objectId },
    userId,
    username,
    timestamp: Date.now(),
  };
}

export function seedDemoObject(
  type: CanvasObject["type"],
  x: number,
  y: number,
  id: string
): CanvasObject {
  return createCanvasObject({
    id,
    type,
    x,
    y,
    width: type === "text" ? 200 : type === "audio" ? 180 : 160,
    height: type === "text" ? 40 : type === "audio" ? 64 : 120,
    props:
      type === "sticky"
        ? { text: "Sticky note", color: "#FDE68A" }
        : type === "text"
          ? { text: "Hello", color: "#1a2330", fontSize: 28 }
          : type === "shape"
            ? { shape: "rect", fill: "#3B82F6" }
            : type === "audio"
              ? { label: "Recording" }
              : {},
  });
}
