import {
  cornerRadiusOf,
  textStyleOf,
  type TextAlign,
  propNumber,
  propPoints,
  propStrokes,
  propString,
  STICKY_RADIUS,
  type CanvasObject,
  type PathPoint,
} from "@infinite-canvas/shared";
import { localMediaUrl } from "@/lib/media/remote";
import { downloadBlob, objectsBounds } from "./utils";

export async function exportPNG(
  objects: CanvasObject[],
  roomId: string
): Promise<void> {
  const bounds = objectsBounds(objects, 40);
  if (!bounds) return;

  const { minX, minY, width, height } = bounds;
  const w = Math.ceil(width);
  const h = Math.ceil(height);

  const canvas = document.createElement("canvas");
  const scale = Math.min(2, 4096 / Math.max(w, h));
  canvas.width = Math.floor(w * scale);
  canvas.height = Math.floor(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = "#f7f8fa";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(-minX, -minY);

  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const o of sorted) {
    ctx.save();
    ctx.globalAlpha = o.opacity ?? 1;
    ctx.translate(o.x + o.width / 2, o.y + o.height / 2);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.translate(-o.width / 2, -o.height / 2);
    await paintObject(ctx, o);
    ctx.restore();
  }

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `canvas-${roomId}.png`);
  }, "image/png");
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: PathPoint[],
  color: string,
  lineWidth: number
) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}


/** Sets the 2D context font/alignment from an object's text styling. */
function applyTextStyle(
  ctx: CanvasRenderingContext2D,
  props: Record<string, unknown>,
  defaults: { align: TextAlign; fontSize: number },
  family: string
): TextAlign {
  const style = textStyleOf(props, defaults);
  const weight = style.bold ? "700" : "400";
  const slant = style.italic ? "italic " : "";
  ctx.font = `${slant}${weight} ${style.fontSize}px ${family}`;
  ctx.textAlign = style.align === "center" ? "center" : style.align === "right" ? "right" : "left";
  return style.align;
}

/** X coordinate matching the canvas textAlign mode. */
function textX(align: TextAlign, width: number, padding: number): number {
  if (align === "center") return width / 2;
  if (align === "right") return width - padding;
  return padding;
}

async function paintObject(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  if (o.type === "shape") {
    const kind = propString(o.props, "shape", "rect");
    ctx.fillStyle = propString(o.props, "fill", "#3B82F6");
    if (kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(o.width / 2, o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "triangle") {
      ctx.beginPath();
      ctx.moveTo(o.width / 2, 0);
      ctx.lineTo(o.width, o.height);
      ctx.lineTo(0, o.height);
      ctx.closePath();
      ctx.fill();
    } else {
      roundRect(ctx, 0, 0, o.width, o.height, cornerRadiusOf(o.props, o.width, o.height));
      ctx.fill();
    }
    for (const stroke of propStrokes(o.props, "scribbles")) {
      strokePolyline(ctx, stroke, "#1a2330", 2.5);
    }
    const label = propString(o.props, "text");
    if (label) {
      ctx.fillStyle = propString(o.props, "textColor", "#ffffff");
      const align = applyTextStyle(
        ctx,
        o.props,
        { align: "center", fontSize: 18 },
        "system-ui, sans-serif"
      );
      ctx.fillText(label, textX(align, o.width, 12), o.height / 2 + 6);
      ctx.textAlign = "start";
    }
  } else if (o.type === "sticky") {
    ctx.fillStyle = propString(o.props, "color", "#FDE68A");
    roundRect(ctx, 0, 0, o.width, o.height, cornerRadiusOf(o.props, o.width, o.height, STICKY_RADIUS));
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    const stickyAlign = applyTextStyle(
      ctx,
      o.props,
      { align: "left", fontSize: 16 },
      "Georgia, serif"
    );
    wrapText(
      ctx,
      propString(o.props, "text"),
      textX(stickyAlign, o.width, 12),
      28,
      o.width - 24,
      18
    );
    ctx.textAlign = "start";
  } else if (o.type === "text") {
    ctx.fillStyle = propString(o.props, "color", "#1a2330");
    const bodyAlign = applyTextStyle(
      ctx,
      o.props,
      { align: "left", fontSize: 24 },
      "system-ui, sans-serif"
    );
    ctx.fillText(
      propString(o.props, "text", "Text"),
      textX(bodyAlign, o.width, 0),
      24
    );
    ctx.textAlign = "start";
  } else if (o.type === "image") {
    const src = propString(o.props, "src");
    const img = src ? await loadImageWithFallback(src, o.id) : null;
    const radius = cornerRadiusOf(o.props, o.width, o.height, 8);
    if (img) {
      ctx.save();
      roundRect(ctx, 0, 0, o.width, o.height, radius);
      ctx.clip();
      ctx.drawImage(img, 0, 0, o.width, o.height);
      ctx.restore();
    } else {
      ctx.fillStyle = "#334155";
      roundRect(ctx, 0, 0, o.width, o.height, radius);
      ctx.fill();
    }
  } else if (o.type === "audio") {
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, 0, 0, o.width, o.height, 12);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px system-ui";
    ctx.fillText("Audio", 16, o.height / 2 + 5);
  } else if (o.type === "path") {
    strokePolyline(
      ctx,
      propPoints(o.props, "points"),
      propString(o.props, "stroke", "#1a2330"),
      propNumber(o.props, "strokeWidth", 3)
    );
  }
}

/**
 * Remote media is served with CORS enabled so it can be drawn into a canvas that
 * is later exported; if the server is unreachable the local blob cache is tried
 * before giving up on the tile.
 */
async function loadImageWithFallback(
  src: string,
  objectId: string
): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(src);
  } catch {
    try {
      const fallback = await localMediaUrl(objectId);
      return fallback ? await loadImage(fallback) : null;
    } catch {
      return null;
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}
