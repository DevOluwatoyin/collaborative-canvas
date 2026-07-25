export const CULL_MARGIN = 400;
export const HANDLE_SIZE = 8;
export const MIN_SIZE = 24;
export const GRID_STEP = 80;
export const SELECTION_COLOR = 0x0d9f90;
export const STROKE_DEFAULT = 0x1a2330;

/**
 * The canvas surface is painted by the WebGL renderer, not CSS, so it needs its
 * own copy of the palette. Without this the chrome would follow the theme while
 * the canvas stayed light, and dark panels would float on a white page.
 */
export const CANVAS_THEME = {
  light: { background: "#f7f8fa", grid: 0xd8dde5 },
  dark: { background: "#101012", grid: 0x24262b },
} as const;

export type CanvasThemeMode = keyof typeof CANVAS_THEME;

/**
 * Below this zoom, objects draw as plain silhouettes without text or
 * decoration. Labels are unreadable at that scale and text layout is the most
 * expensive part of building a display.
 */
export const LOD_ZOOM_THRESHOLD = 0.3;

/** Per-frame fraction of the remaining distance a physics body closes. */
export const INTERPOLATION_RATE = 0.25;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
