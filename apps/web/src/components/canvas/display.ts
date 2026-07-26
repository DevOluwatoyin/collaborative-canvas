import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
import {
  cornerRadiusOf,
  propNumber,
  propPoints,
  propStrokes,
  propString,
  STICKY_RADIUS,
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
      entry.bg.roundRect(
        0,
        0,
        obj.width,
        obj.height,
        cornerRadiusOf(obj.props, obj.width, obj.height)
      );
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
    entry.bg.roundRect(
      0,
      0,
      obj.width,
      obj.height,
      cornerRadiusOf(obj.props, obj.width, obj.height, STICKY_RADIUS)
    );
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
    entry.bg.roundRect(
      0,
      0,
      obj.width,
      obj.height,
      cornerRadiusOf(obj.props, obj.width, obj.height, IMAGE_DEFAULT_RADIUS)
    );
    entry.bg.fill(0xe8ecf1);
    entry.bg.stroke({ width: 2, color: 0xcbd5e1 });
    void ensureImage(entry, obj);
    // A resize redraws the display but reuses the sprite, so it needs resizing
    // explicitly rather than waiting for a fresh load.
    resizeImageSprite(entry, obj);
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

/** Matches the placeholder frame, so an unstyled image still looks softened. */
const IMAGE_DEFAULT_RADIUS = 8;

/**
 * Sprites are rectangular textures, so rounded corners come from a Graphics
 * mask redrawn whenever the object's size or radius changes.
 */
function applyImageMask(entry: DisplayEntry, obj: CanvasObject, sprite: Sprite) {
  const radius = cornerRadiusOf(
    obj.props,
    obj.width,
    obj.height,
    IMAGE_DEFAULT_RADIUS
  );
  let mask = entry.root.children.find((c) => c.label === "imgMask") as
    | Graphics
    | undefined;
  if (!mask) {
    mask = new Graphics();
    mask.label = "imgMask";
    entry.root.addChild(mask);
  }
  mask.clear();
  mask.roundRect(0, 0, obj.width, obj.height, radius);
  mask.fill(0xffffff);
  sprite.mask = mask;
}

/** In-flight or completed loads, so a redraw does not restart a load. */
const imageAttempts = new Set<string>();
const textureCache = new Map<string, Texture>();

/**
 * Decodes an image URL into a texture via an HTMLImageElement.
 *
 * Pixi's `Assets.load` picks a parser from the URL extension, and neither of the
 * two forms used here has one: media served by the collab server is
 * `/media/<id>`, and the offline fallback is a `data:` or `blob:` URL. Assets
 * therefore refused to load them and every image rendered as an empty
 * placeholder. Going through the browser's own image decoder sidesteps parser
 * resolution entirely.
 */
async function loadTexture(src: string): Promise<Texture> {
  const cached = textureCache.get(src);
  if (cached) return cached;

  const image = new Image();
  // Same-origin data/blob URLs must not carry the CORS attribute, but remote
  // media must, or the canvas is tainted and PNG export throws.
  if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();

  const texture = Texture.from(image);
  textureCache.set(src, texture);
  return texture;
}

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

  const attach = (texture: Texture) => {
    if (entry.root.destroyed) return;
    for (const child of [...entry.root.children]) {
      if (child.label === "img") child.destroy();
    }
    const sprite = new Sprite(texture);
    sprite.label = "img";
    sprite.width = obj.width;
    sprite.height = obj.height;
    entry.root.addChildAt(sprite, 1);
    applyImageMask(entry, obj, sprite);
  };

  try {
    attach(await loadTexture(src));
    return;
  } catch {
    // Remote fetch failed; try the locally cached copy below.
  }

  try {
    const fallback = await localMediaUrl(obj.id);
    if (fallback) {
      attach(await loadTexture(fallback));
      return;
    }
  } catch {
    // Fall through to the retry release below.
  }

  // Both paths failed: forget the attempt so a later redraw can retry once the
  // media server or the network comes back.
  imageAttempts.delete(key);
}

/** Resizes an already-attached image sprite when its object is resized. */
export function resizeImageSprite(entry: DisplayEntry, obj: CanvasObject) {
  for (const child of entry.root.children) {
    if (child.label !== "img") continue;
    const sprite = child as Sprite;
    sprite.width = obj.width;
    sprite.height = obj.height;
    // The mask must track both the new size and any corner-radius change that
    // triggered this redraw.
    applyImageMask(entry, obj, sprite);
  }
}

/** "Ada Lovelace" -> "Ada". Keeps the cursor tag short enough to follow. */
function firstName(username: string): string {
  const first = username.trim().split(/\s+/)[0] ?? username;
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}

/**
 * Draws an arrow plus a name tag for every collaborator with a live cursor, so a
 * moving pointer is always attributable to a person.
 */
export function syncRemoteCursors(
  layer: Container,
  presences: { cursor: PathPoint | null; color: string; username: string }[]
) {
  layer.removeChildren().forEach((c) => c.destroy());

  for (const p of presences) {
    if (!p.cursor) continue;
    const color = parseColor(p.color);
    const wrap = new Container();
    wrap.position.set(p.cursor.x, p.cursor.y);

    const pointer = new Graphics();
    pointer.moveTo(0, 0);
    pointer.lineTo(0, 16);
    pointer.lineTo(4.4, 12.2);
    pointer.lineTo(7.2, 18);
    pointer.lineTo(10, 16.6);
    pointer.lineTo(7.2, 11);
    pointer.lineTo(12.4, 10.6);
    pointer.closePath();
    pointer.fill(color);
    pointer.stroke({ width: 1.2, color: 0xffffff });
    wrap.addChild(pointer);

    const label = new Text({
      text: firstName(p.username),
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }),
    });
    // The tag sits below-right of the hotspot so it never covers what the
    // collaborator is pointing at.
    const padX = 6;
    const padY = 3;
    const tag = new Graphics();
    tag.roundRect(0, 0, label.width + padX * 2, label.height + padY * 2, 6);
    tag.fill(color);
    tag.position.set(12, 18);
    label.position.set(12 + padX, 18 + padY);
    wrap.addChild(tag);
    wrap.addChild(label);

    layer.addChild(wrap);
  }
}
