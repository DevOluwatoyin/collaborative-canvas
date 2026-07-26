import {
  createCanvasObject,
  createDefaultPhysics,
  propStrokes,
  type CanvasObject,
  type PathPoint,
  type ShapeKind,
  type Tool,
} from "@infinite-canvas/shared";
import type { RoomBindings } from "@/lib/yjs/provider";
import { readObject } from "@/lib/yjs/objects";
import {
  createRoomObject,
  newObjectId,
  nextZIndex,
  patchProps,
  type Actor,
  type ObjectStyle,
} from "./core";

/** Picks black or white body text for a filled shape by perceived lightness. */
function readableTextOn(hex: string): string {
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
  const id = newObjectId();
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

export function createObjectAt(
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
): { id: string; openEditor: boolean; switchToSelect: boolean } | null {
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

  const id = newObjectId();
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
  } else if (type === "image" || type === "audio") {
    // Both are created by the toolbar, which opens the file picker or the
    // recorder immediately. Handling them here would mean the icon does nothing
    // until the user also clicks the canvas.
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
