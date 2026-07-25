/** Parse #RGB / #RRGGBB into a Pixi numeric color. */
export function parseColor(hex: string): number {
  const h = hex.replace("#", "");
  return parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
}
