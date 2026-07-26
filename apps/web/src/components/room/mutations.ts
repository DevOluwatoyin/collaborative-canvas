import { nanoid } from "nanoid";
import {
  createCanvasObject,
  createDefaultPhysics,
  propStrokes,
  type CanvasObject,
  type GuestIdentity,
  type HistoryOp,
  type PathPoint,
  type ShapeKind,
  type Tool,
} from "@infinite-canvas/shared";
import { appendHistory, type RoomBindings } from "@/lib/yjs/provider";
import {
  deleteYObject,
  patchYObject,
  readObject,
  upsertYObject,
} from "@/lib/yjs/objects";
import {
  historyOpFromCreate,
  historyOpFromDelete,
  historyOpFromUpdate,
} from "@/lib/history/replay";
import { blobToDataUrl, putMediaBlob } from "@/lib/media/store";
import { uploadMedia } from "@/lib/media/remote";
import type { PhysicsBridge } from "@/lib/physics/engine";
import { pickFile } from "./media";

type Actor = Pick<GuestIdentity, "id" | "username">;

/** The style newly created objects inherit from the style panel. */
export type ObjectStyle = {
  color: string;
  fontSize: number;
  strokeWidth: number;
  opacity: number;
};

/** Picks black or white body text for a filled shape by perceived lightness. */
export function readableTextOn(hex: string): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return "#ffffff";
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1d1d1d" : "#ffffff";
}

/**
 * Puts new objects on top without scanning every object's zIndex. A timestamp is
 * monotonic per client and good enough for paint order; ties across clients are
 * resolved arbitrarily but consistently, since every peer sorts the same values.
 */
function nextZIndex(): number {
  return Date.now();
}

export function updateRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  id: string,
  patch: Partial<CanvasObject>,
  recordHistory = true
) {
  patchYObject(bindings.objects, id, patch);
  if (recordHistory) {
    appendHistory(
      bindings.history,
      historyOpFromUpdate(id, patch, actor.id, actor.username)
    );
  }
}

export function deleteRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  id: string
) {
  bindings.doc.transact(() => {
    deleteYObject(bindings.objects, id);
    appendHistory(
      bindings.history,
      historyOpFromDelete(id, actor.id, actor.username)
    );
  });
}

function createRoomObject(
  bindings: RoomBindings,
  actor: Actor,
  obj: CanvasObject
): void {
  bindings.doc.transact(() => {
    upsertYObject(bindings.objects, obj);
    appendHistory(
      bindings.history,
      historyOpFromCreate(obj, actor.id, actor.username)
    );
  });
}

/** Records a prop patch and its history op in one transaction. */
function patchProps(
  bindings: RoomBindings,
  actor: Actor,
  id: string,
  props: Record<string, unknown>
): void {
  bindings.doc.transact(() => {
    patchYObject(bindings.objects, id, { props });
    appendHistory(
      bindings.history,
      historyOpFromUpdate(id, { props }, actor.id, actor.username)
    );
  });
}

export function createPathFromStroke(
  bindings: RoomBindings,
  actor: Actor,
  points: PathPoint[],
  targetShapeId: string | null,
  style: ObjectStyle
): string | null {
  if (points.length < 2) return null;

  if (targetShapeId) {
    const target = bindings.objects.get(targetShapeId);
    if (target) {
      const shape = readObject(target);
      if (shape.type === "shape") {
        const local = points.map((p) => ({ x: p.x - shape.x, y: p.y - shape.y }));
        const scribbles = [...propStrokes(shape.props, "scribbles"), local];
        patchProps(bindings, actor, targetShapeId, { scribbles });
        return targetShapeId;
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 4;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const id = nanoid(10);
  const obj = createCanvasObject({
    id,
    type: "path",
    x: minX,
    y: minY,
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
    zIndex: nextZIndex(),
    opacity: style.opacity,
    createdBy: actor.id,
    props: {
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      stroke: style.color,
      strokeWidth: style.strokeWidth,
    },
  });
  createRoomObject(bindings, actor, obj);
  return id;
}

/**
 * Uploads media to the collab server and returns props referencing it by URL.
 * Falls back to an inline data URL only when the upload cannot be made, so
 * creating media offline still works — at the cost of document size until it is
 * re-created online.
 */
async function mediaProps(
  objectId: string,
  blob: Blob,
  extra: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await putMediaBlob(objectId, blob);
  const uploaded = await uploadMedia(blob);
  if (uploaded) {
    return { ...extra, src: uploaded.url, mediaId: uploaded.id };
  }
  return { ...extra, src: await blobToDataUrl(blob), inlineMedia: true };
}

export async function createObjectAt(
  bindings: RoomBindings,
  actor: Actor,
  world: PathPoint,
  opts: {
    tool: Tool;
    shapeKind: ShapeKind;
    style: ObjectStyle;
    forceType?: CanvasObject["type"];
    hitId?: string | null;
  }
): Promise<{ id: string; openEditor: boolean; switchToSelect: boolean } | null> {
  const type =
    opts.forceType ??
    (opts.tool === "select" ||
    opts.tool === "pan" ||
    opts.tool === "physics" ||
    opts.tool === "draw"
      ? "shape"
      : opts.tool);

  // Clicking a shape with the text tool labels that shape instead of stacking a
  // separate text object on top of it.
  const hitId = opts.hitId;
  if (type === "text" && hitId) {
    const hit = bindings.objects.get(hitId);
    if (hit && readObject(hit).type === "shape") {
      patchProps(bindings, actor, hitId, {
        text: "Text",
        textColor: "#ffffff",
        fontSize: 18,
      });
      return { id: hitId, openEditor: true, switchToSelect: true };
    }
  }

  const id = nanoid(10);
  let props: Record<string, unknown> = {};
  let width = 160;
  let height = 120;

  const { color, fontSize } = opts.style;

  if (type === "text") {
    props = { text: "Text", color, fontSize };
    width = 220;
    height = Math.max(48, Math.round(fontSize * 1.7));
  } else if (type === "shape") {
    props = {
      shape: opts.shapeKind,
      fill: color,
      text: "",
      textColor: readableTextOn(color),
      fontSize,
    };
  } else if (type === "sticky") {
    // Stickies stay on a pale paper tint; the picked colour would swamp the note.
    props = {
      text: "New idea…",
      color: ["#FDE68A", "#F9A8D4", "#A5F3FC", "#BBF7D0"][Math.floor(Math.random() * 4)],
      fontSize,
    };
    width = 180;
    height = 160;
  } else if (type === "image") {
    const file = await pickFile("image/*");
    if (!file) return null;
    props = await mediaProps(id, file, { name: file.name });
    width = 240;
    height = 180;
  } else if (type === "audio") {
    // Audio is captured by the recorder panel, which calls createAudioObject
    // when the user stops. Placing one here would mean recording with no UI.
    return null;
  }

  const obj = createCanvasObject({
    id,
    type,
    x: world.x - width / 2,
    y: world.y - height / 2,
    width,
    height,
    zIndex: nextZIndex(),
    opacity: opts.style.opacity,
    createdBy: actor.id,
    props,
    physics: createDefaultPhysics(opts.tool === "physics"),
  });
  createRoomObject(bindings, actor, obj);
  return {
    id,
    openEditor: type === "text" || type === "sticky",
    switchToSelect: opts.tool !== "physics",
  };
}

/** Creates the audio object once the recorder panel has captured a clip. */
export async function createAudioObject(
  bindings: RoomBindings,
  actor: Actor,
  world: PathPoint,
  blob: Blob,
  durationMs: number
): Promise<string> {
  const id = nanoid(10);
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const props = await mediaProps(id, blob, {
    label: `${seconds}s clip`,
    durationMs,
  });
  const width = 200;
  const height = 72;
  const obj = createCanvasObject({
    id,
    type: "audio",
    x: world.x - width / 2,
    y: world.y - height / 2,
    width,
    height,
    zIndex: nextZIndex(),
    createdBy: actor.id,
    props,
  });
  createRoomObject(bindings, actor, obj);
  return id;
}

export function flingRoomObject(
  bindings: RoomBindings,
  physics: PhysicsBridge | null,
  actor: Actor,
  id: string,
  vx: number,
  vy: number
) {
  const y = bindings.objects.get(id);
  if (!y) return;
  const current = readObject(y);
  const nextPhysics = {
    ...(current.physics ?? createDefaultPhysics(true)),
    enabled: true,
  };
  bindings.doc.transact(() => {
    patchYObject(bindings.objects, id, { physics: nextPhysics, vx, vy });
    appendHistory(bindings.history, {
      id: `h-${nanoid(10)}`,
      type: "physicsImpulse",
      objectId: id,
      payload: { vx, vy, x: current.x, y: current.y },
      userId: actor.id,
      username: actor.username,
      timestamp: Date.now(),
    });
  });
  physics?.applyImpulse(id, vx, vy);
}

const DUPLICATE_OFFSET = 24;

/** Copies objects with fresh ids, nudged so the copy is visibly on top. */
/**
 * Inserts objects that came from the clipboard. Ids are always regenerated so a
 * paste into the room the objects were copied from creates copies rather than
 * silently overwriting the originals.
 */
export function pasteRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  objects: readonly CanvasObject[]
): string[] {
  const created: string[] = [];
  bindings.doc.transact(() => {
    for (const source of objects) {
      if (!source || typeof source !== "object") continue;
      const copy = createCanvasObject({
        ...source,
        id: nanoid(10),
        x: (source.x ?? 0) + DUPLICATE_OFFSET,
        y: (source.y ?? 0) + DUPLICATE_OFFSET,
        zIndex: nextZIndex(),
        createdBy: actor.id,
        props: { ...(source.props ?? {}) },
      });
      upsertYObject(bindings.objects, copy);
      appendHistory(
        bindings.history,
        historyOpFromCreate(copy, actor.id, actor.username)
      );
      created.push(copy.id);
    }
  });
  return created;
}

export function duplicateRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  ids: readonly string[]
): string[] {
  const created: string[] = [];
  bindings.doc.transact(() => {
    for (const id of ids) {
      const source = bindings.objects.get(id);
      if (!source) continue;
      const original = readObject(source);
      const copy = createCanvasObject({
        ...original,
        id: nanoid(10),
        x: original.x + DUPLICATE_OFFSET,
        y: original.y + DUPLICATE_OFFSET,
        zIndex: nextZIndex(),
        createdBy: actor.id,
        props: { ...original.props },
      });
      upsertYObject(bindings.objects, copy);
      appendHistory(
        bindings.history,
        historyOpFromCreate(copy, actor.id, actor.username)
      );
      created.push(copy.id);
    }
  });
  return created;
}

/**
 * Moves objects to the front or back of the paint order. zIndex is a plain
 * number, so this only has to clear the current extreme.
 */
export function reorderRoomObjects(
  bindings: RoomBindings,
  actor: Actor,
  ids: readonly string[],
  edge: "front" | "back"
): void {
  if (ids.length === 0) return;
  let min = Infinity;
  let max = -Infinity;
  bindings.objects.forEach((y) => {
    const z = Number(y.get("zIndex") ?? 0);
    if (z < min) min = z;
    if (z > max) max = z;
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;

  bindings.doc.transact(() => {
    ids.forEach((id, index) => {
      const zIndex = edge === "front" ? max + 1 + index : min - 1 - index;
      updateRoomObject(bindings, actor, id, { zIndex });
    });
  });
}

/**
 * Records what an undo or redo actually changed as one batch op, so Time Travel
 * stays a truthful log. Without this the op log would still contain the create
 * that an undo just reverted, and replay would show a phantom object.
 */
export function recordUndoDiff(
  bindings: RoomBindings,
  actor: Actor,
  before: Map<string, CanvasObject>,
  after: Map<string, CanvasObject>,
  label: "undo" | "redo"
): void {
  const ops: HistoryOp[] = [];
  for (const [id, previous] of before) {
    const current = after.get(id);
    if (!current) {
      ops.push(historyOpFromDelete(id, actor.id, actor.username));
    } else if (current !== previous) {
      ops.push(historyOpFromUpdate(id, current, actor.id, actor.username));
    }
  }
  for (const [id, current] of after) {
    if (!before.has(id)) {
      ops.push(historyOpFromCreate(current, actor.id, actor.username));
    }
  }
  if (ops.length === 0) return;
  appendHistory(bindings.history, {
    id: `h-${nanoid(10)}`,
    type: "batch",
    payload: { ops, label },
    userId: actor.id,
    username: actor.username,
    timestamp: Date.now(),
  });
}

/**
 * Load generator for the object-count performance target. Goes through the
 * normal object path so bulk objects are structured exactly like user-created
 * ones, in one transaction so peers receive a single update rather than N.
 */
export function spawnBulkObjects(
  bindings: RoomBindings,
  actor: Actor,
  count: number
): void {
  const colors = ["#3B82F6", "#E85D4C", "#2BB673", "#F59E0B", "#EC4899", "#14B8A6"];
  const spread = Math.max(2000, Math.sqrt(count) * 220);
  const batch = Date.now().toString(36);
  bindings.doc.transact(() => {
    for (let i = 0; i < count; i++) {
      const obj = createCanvasObject({
        id: `bulk-${batch}-${i}`,
        type: "shape",
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread * 0.75,
        rotation: Math.random() * 40 - 20,
        width: 40 + Math.random() * 60,
        height: 40 + Math.random() * 60,
        zIndex: i,
        createdBy: actor.id,
        props: {
          shape: Math.random() > 0.5 ? "rect" : "ellipse",
          fill: colors[i % colors.length],
          text: "",
        },
      });
      upsertYObject(bindings.objects, obj);
    }
  });
}
