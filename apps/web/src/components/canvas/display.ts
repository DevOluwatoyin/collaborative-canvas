import { Container, Graphics, Text, TextStyle, Sprite, Assets } from "pixi.js";
import {
  propNumber,
  propPoints,
  propStrokes,
  propString,
  type CanvasObject,
  type PathPoint,
} from "@infinite-canvas/shared";
import { localMediaUrl } from "@/lib/media/remote";
import { parseColor } from "./color";
import type { DisplayEntry } from "./types";

export function createDisplay(obj: CanvasObject): DisplayEntry {
  const root = new Container();
  const bg = new Graphics();
  root.addChild(bg);
  const needsLabel =
    obj.type === "text" ||
    obj.type === "sticky" ||
    obj.type === "audio" ||
    obj.type === "shape";
  let label: Text | undefined;
  if (needsLabel) {
    label = new Text({
      text: "",
      style: new TextStyle({
        fill: 0x1f2937,
        fontSize: 14,
        wordWrap: true,
        wordWrapWidth: Math.max(20, obj.width - 16),
        fontFamily:
          obj.type === "sticky" ? "Georgia, serif" : "Segoe UI, system-ui, sans-serif",
        align: "center",
      }),
    });
    root.addChild(label);
  }
  root.eventMode = "none";
  return { root, bg, label };
}

export function drawPolyline(
  g: Graphics,
  points: PathPoint[],
  color: number,
  width: number
) {
  if (points.length < 2) return;
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.stroke({ width, color, cap: "round", join: "round" });
}

/**
 * Redraws a display. `lod` collapses an object to its silhouette: at far zoom
 * the text is sub-pixel anyway, and skipping layout is the single biggest win
 * when thousands of objects are on screen.
 */
export function updateDisplay(
  entry: DisplayEntry,
  obj: CanvasObject,
  selected: boolean,
  lod: boolean,
  /** Fire-and-forget: texture loading resolves after this synchronous pass. */
  ensureImage: (entry: DisplayEntry, obj: CanvasObject) => void | Promise<void>
) {
  entry.bg.clear();
  if (entry.label) entry.label.visible = false;
  entry.root.alpha = obj.opacity ?? 1;

  if (lod) {
    entry.bg.rect(0, 0, obj.width, obj.height);
    entry.bg.fill(lodColor(obj));
    return;
  }

  if (obj.type === "path") {
    const localPoints = propPoints(obj.props, "points");
    const color = parseColor(propString(obj.props, "stroke", "#1a2330"));
    const strokeW = propNumber(obj.props, "strokeWidth", 3);
    entry.bg.rect(0, 0, obj.width, obj.height);
    entry.bg.fill({ color: 0x000000, alpha: 0.001 });
    drawPolyline(entry.bg, localPoints, color, strokeW);
  } else if (obj.type === "shape") {
    const fill = parseColor(propString(obj.props, "fill", "#3B82F6"));
    const kind = propString(obj.props, "shape", "rect");
    if (kind === "ellipse") {
      entry.bg.ellipse(obj.width / 2, obj.height / 2, obj.width / 2, obj.height / 2);
      entry.bg.fill(fill);
    } else if (kind === "triangle") {
      entry.bg.moveTo(obj.width / 2, 0);
      entry.bg.lineTo(obj.width, obj.height);
      entry.bg.lineTo(0, obj.height);
      entry.bg.closePath();
      entry.bg.fill(fill);
    } else {
      entry.bg.roundRect(0, 0, obj.width, obj.height, 10);
      entry.bg.fill(fill);
    }
    for (const stroke of propStrokes(obj.props, "scribbles")) {
      drawPolyline(entry.bg, stroke, 0x1a2330, 2.5);
    }
    if (entry.label) {
      const text = propString(obj.props, "text");
      entry.label.visible = Boolean(text);
      entry.label.style.fill = parseColor(
        propString(obj.props, "textColor", "#ffffff")
      );
      entry.label.style.fontSize = propNumber(obj.props, "fontSize", 18);
      entry.label.style.wordWrapWidth = Math.max(20, obj.width - 24);
      entry.label.style.align = "center";
      entry.label.text = text;
      entry.label.x = obj.width / 2 - entry.label.width / 2;
      entry.label.y = obj.height / 2 - entry.label.height / 2;
    }
  } else if (obj.type === "sticky") {
    entry.bg.roundRect(0, 0, obj.width, obj.height, 4);
    entry.bg.fill(parseColor(propString(obj.props, "color", "#FDE68A")));
    if (entry.label) {
      entry.label.visible = true;
      entry.label.style.fill = 0x1f2937;
      entry.label.style.wordWrapWidth = Math.max(20, obj.width - 20);
      entry.label.style.align = "left";
      entry.label.text = propString(obj.props, "text");
      entry.label.x = 10;
      entry.label.y = 10;
    }
  } else if (obj.type === "text") {
    entry.bg.rect(0, 0, obj.width, obj.height);
    entry.bg.fill({ color: 0x000000, alpha: selected ? 0.04 : 0.001 });
    if (entry.label) {
      entry.label.visible = true;
      entry.label.style.fill = parseColor(propString(obj.props, "color", "#1a2330"));
      entry.label.style.fontSize = propNumber(obj.props, "fontSize", 24);
      entry.label.style.wordWrapWidth = Math.max(20, obj.width);
      entry.label.style.align = "left";
      entry.label.text = propString(obj.props, "text", "Text");
      entry.label.x = 0;
      entry.label.y = 0;
    }
  } else if (obj.type === "image") {
    entry.bg.roundRect(0, 0, obj.width, obj.height, 8);
    entry.bg.fill(0xe8ecf1);
    entry.bg.stroke({ width: 2, color: 0xcbd5e1 });
    void ensureImage(entry, obj);
  } else if (obj.type === "audio") {
    entry.bg.roundRect(0, 0, obj.width, obj.height, 12);
    entry.bg.fill(0x1e293b);
    entry.bg.stroke({ width: 2, color: 0x38bdf8 });
    if (entry.label) {
      entry.label.visible = true;
      entry.label.style.fill = 0xe2e8f0;
      entry.label.text = `♪ ${propString(obj.props, "label", "Audio")}`;
      entry.label.x = 10;
      entry.label.y = 10;
    }
  }
}

function lodColor(obj: CanvasObject): number {
  switch (obj.type) {
    case "shape":
      return parseColor(propString(obj.props, "fill", "#3B82F6"));
    case "sticky":
      return parseColor(propString(obj.props, "color", "#FDE68A"));
    case "audio":
      return 0x1e293b;
    case "image":
      return 0xcbd5e1;
    default:
      return 0x94a3b8;
  }
}

const imageAttempts = new Set<string>();

/**
 * Loads an image texture, falling back to the locally cached blob when the
 * remote URL cannot be fetched (server down, or uploaded by a peer that is now
 * offline).
 */
export async function ensureImageTexture(entry: DisplayEntry, obj: CanvasObject) {
  const src = propString(obj.props, "src");
  if (!src) return;
  const key = obj.id + src;
  if (imageAttempts.has(key)) return;
  imageAttempts.add(key);

  const attach = (texture: Parameters<typeof Sprite.from>[0]) => {
    if (entry.root.destroyed) return;
    for (const child of [...entry.root.children]) {
      if (child.label === "img") child.destroy();
    }
    const sprite = Sprite.from(texture);
    sprite.label = "img";
    sprite.width = obj.width;
    sprite.height = obj.height;
    entry.root.addChildAt(sprite, 1);
  };

  try {
    attach(await Assets.load(src));
    return;
  } catch {
    // Remote fetch failed; try the local cache below.
  }

  try {
    const fallback = await localMediaUrl(obj.id);
    if (fallback) attach(await Assets.load(fallback));
  } catch {
    // Keep the placeholder rectangle.
  }
}

export function syncRemoteCursors(
  layer: Container,
  presences: { cursor: PathPoint | null; color: string; username: string }[]
) {
  layer.removeChildren().forEach((c) => c.destroy());
  for (const p of presences) {
    if (!p.cursor) continue;
    const g = new Graphics();
    g.circle(0, 0, 6);
    g.fill(parseColor(p.color));
    g.position.set(p.cursor.x, p.cursor.y);
    const label = new Text({
      text: p.username,
      style: new TextStyle({
        fill: parseColor(p.color),
        fontSize: 12,
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }),
    });
    label.position.set(10, -6);
    const wrap = new Container();
    wrap.addChild(g);
    wrap.addChild(label);
    layer.addChild(wrap);
  }
}
