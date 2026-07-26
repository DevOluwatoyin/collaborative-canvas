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
import { downloadBlob, escapeXml, objectsBounds } from "./utils";

/** Builds an SVG path `d` attribute from points offset by an object's origin. */
function pathData(points: PathPoint[], ox: number, oy: number): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${ox + p.x} ${oy + p.y}`)
    .join(" ");
}

export function exportSVG(objects: CanvasObject[], roomId: string) {
  const bounds = objectsBounds(objects, 40);
  if (!bounds) {
    const blob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"></svg>'],
      { type: "image/svg+xml" }
    );
    downloadBlob(blob, `canvas-${roomId}.svg`);
    return;
  }

  const { minX, minY, width, height } = bounds;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#f7f8fa"/>`,
  ];

  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const o of sorted) {
    const opacity = o.opacity ?? 1;
    if (opacity <= 0) continue;
    const alpha = opacity < 1 ? ` opacity="${opacity}"` : "";
    const rot =
      (o.rotation
        ? ` transform="rotate(${o.rotation} ${o.x + o.width / 2} ${o.y + o.height / 2})"`
        : "") + alpha;
    if (o.type === "shape") {
      const kind = propString(o.props, "shape", "rect");
      const fill = escapeXml(propString(o.props, "fill", "#3B82F6"));
      const shape =
        kind === "ellipse"
          ? `<ellipse cx="${o.x + o.width / 2}" cy="${o.y + o.height / 2}" rx="${o.width / 2}" ry="${o.height / 2}" fill="${fill}"/>`
          : kind === "triangle"
            ? `<polygon points="${o.x + o.width / 2},${o.y} ${o.x + o.width},${o.y + o.height} ${o.x},${o.y + o.height}" fill="${fill}"/>`
            : `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${cornerRadiusOf(o.props, o.width, o.height)}" fill="${fill}"/>`;
      // Freehand annotations drawn onto a shape live in props.scribbles and were
      // previously dropped from the export entirely.
      const scribbles = propStrokes(o.props, "scribbles")
        .map(
          (stroke) =>
            `<path d="${pathData(stroke, o.x, o.y)}" fill="none" stroke="#1a2330" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");
      const label = propString(o.props, "text");
      const labelSvg = label
        ? `<text x="${o.x + o.width / 2}" y="${o.y + o.height / 2 + 6}" fill="${escapeXml(
            propString(o.props, "textColor", "#ffffff")
          )}" font-family="system-ui,sans-serif" font-size="${propNumber(
            o.props,
            "fontSize",
            18
          )}" text-anchor="middle">${escapeXml(label)}</text>`
        : "";
      parts.push(`<g${rot}>${shape}${scribbles}${labelSvg}</g>`);
    } else if (o.type === "sticky") {
      const fill = escapeXml(propString(o.props, "color", "#FDE68A"));
      const text = escapeXml(propString(o.props, "text"));
      parts.push(
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="${fill}" rx="${cornerRadiusOf(o.props, o.width, o.height, STICKY_RADIUS)}"/><text x="${o.x + 12}" y="${o.y + 28}" fill="#1f2937" font-family="Georgia, serif" font-size="14">${text}</text></g>`
      );
    } else if (o.type === "text") {
      const text = escapeXml(propString(o.props, "text", "Text"));
      const fill = escapeXml(propString(o.props, "color", "#1a2330"));
      parts.push(
        `<text x="${o.x}" y="${o.y + 24}" fill="${fill}" font-family="system-ui,sans-serif" font-size="${propNumber(o.props, "fontSize", 24)}"${rot}>${text}</text>`
      );
    } else if (o.type === "image") {
      const src = propString(o.props, "src");
      if (src) {
        const radius = cornerRadiusOf(o.props, o.width, o.height, 8);
        const clip =
          radius > 0 ? ` clip-path="inset(0% round ${radius}px)"` : "";
        parts.push(
          `<image href="${escapeXml(src)}" x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"${clip}${rot}/>`
        );
      }
    } else if (o.type === "audio") {
      parts.push(
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="12" fill="#1e293b" stroke="#38bdf8"/><text x="${o.x + 16}" y="${o.y + o.height / 2 + 5}" fill="#e2e8f0" font-size="14">Audio</text></g>`
      );
    } else if (o.type === "path") {
      const pts = propPoints(o.props, "points");
      if (pts.length >= 2) {
        parts.push(
          `<path d="${pathData(pts, o.x, o.y)}" fill="none" stroke="${escapeXml(
            propString(o.props, "stroke", "#1a2330")
          )}" stroke-width="${propNumber(o.props, "strokeWidth", 3)}" stroke-linecap="round" stroke-linejoin="round"${rot}/>`
        );
      }
    }
  }
  parts.push("</svg>");
  const blob = new Blob([parts.join("\n")], { type: "image/svg+xml" });
  downloadBlob(blob, `canvas-${roomId}.svg`);
}
