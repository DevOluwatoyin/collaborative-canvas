import { nanoid } from "nanoid";
import {
  createCanvasObject,
  createDefaultPhysics,
  propStrokes,
  type CanvasObject,
  type GuestIdentity,
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
import { pickFile, recordAudioBrief } from "./media";

type Actor = Pick<GuestIdentity, "id" | "username">;

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
  targetShapeId: string | null
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
    zIndex: Date.now(),
    createdBy: actor.id,
    props: {
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      stroke: "#1a2330",
      strokeWidth: 3,
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

  if (type === "text") {
    props = { text: "Text", color: "#1a2330", fontSize: 28 };
    width = 220;
    height = 48;
  } else if (type === "shape") {
    props = {
      shape: opts.shapeKind,
      fill: ["#3B82F6", "#E85D4C", "#2BB673", "#F59E0B"][Math.floor(Math.random() * 4)],
      text: "",
      textColor: "#ffffff",
      fontSize: 18,
    };
  } else if (type === "sticky") {
    props = {
      text: "New idea…",
      color: ["#FDE68A", "#F9A8D4", "#A5F3FC", "#BBF7D0"][Math.floor(Math.random() * 4)],
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
    const recorded = await recordAudioBrief();
    if (!recorded) return null;
    props = await mediaProps(id, recorded, { label: "Recording" });
    width = 200;
    height = 72;
  }

  const obj = createCanvasObject({
    id,
    type,
    x: world.x - width / 2,
    y: world.y - height / 2,
    width,
    height,
    zIndex: Date.now(),
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
