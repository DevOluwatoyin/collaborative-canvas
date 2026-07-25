import type { CanvasObject } from "@infinite-canvas/shared";

/**
 * A 12-colour palette laid out as three rows of four, matching the reference
 * canvas UI. Values are chosen to stay legible against both the light canvas and
 * white sticky text.
 */
export const PALETTE = [
  { name: "black", hex: "#1d1d1d" },
  { name: "grey", hex: "#9aa3af" },
  { name: "light-violet", hex: "#e085f4" },
  { name: "violet", hex: "#ae3ec9" },
  { name: "blue", hex: "#4465e9" },
  { name: "light-blue", hex: "#4ba1f1" },
  { name: "yellow", hex: "#f1ac4b" },
  { name: "orange", hex: "#e16919" },
  { name: "green", hex: "#099268" },
  { name: "light-green", hex: "#4cb05e" },
  { name: "light-red", hex: "#ff8787" },
  { name: "red", hex: "#e03131" },
] as const;

export type SizeName = "s" | "m" | "l" | "xl";

export const SIZES: SizeName[] = ["s", "m", "l", "xl"];

/** Size is one control driving two properties, depending on the object type. */
const FONT_SIZE: Record<SizeName, number> = { s: 14, m: 20, l: 28, xl: 44 };
const STROKE_WIDTH: Record<SizeName, number> = { s: 2, m: 3, l: 5, xl: 9 };

export function fontSizeFor(size: SizeName): number {
  return FONT_SIZE[size];
}

export function strokeWidthFor(size: SizeName): number {
  return STROKE_WIDTH[size];
}

export function sizeFromFontSize(value: number): SizeName {
  let best: SizeName = "m";
  let bestDelta = Infinity;
  for (const size of SIZES) {
    const delta = Math.abs(FONT_SIZE[size] - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = size;
    }
  }
  return best;
}

/** The prop that carries an object's colour differs per type. */
export function colorPropFor(type: CanvasObject["type"]): string | null {
  switch (type) {
    case "shape":
      return "fill";
    case "sticky":
      return "color";
    case "text":
      return "color";
    case "path":
      return "stroke";
    default:
      // Images and audio have no tintable colour.
      return null;
  }
}

/** Builds the prop patch that applies a colour to one object. */
export function colorPatch(
  type: CanvasObject["type"],
  hex: string
): Record<string, unknown> | null {
  const prop = colorPropFor(type);
  return prop ? { [prop]: hex } : null;
}

/** Builds the prop patch that applies a size to one object. */
export function sizePatch(
  type: CanvasObject["type"],
  size: SizeName
): Record<string, unknown> | null {
  if (type === "path") return { strokeWidth: strokeWidthFor(size) };
  if (type === "text" || type === "sticky" || type === "shape") {
    return { fontSize: fontSizeFor(size) };
  }
  return null;
}
