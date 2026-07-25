export const CULL_MARGIN = 400;
export const HANDLE_SIZE = 8;
export const MIN_SIZE = 24;
export const GRID_STEP = 80;
export const CANVAS_BG = "#f7f8fa";
export const SELECTION_COLOR = 0x0d9f90;
export const STROKE_DEFAULT = 0x1a2330;

/**
 * Below this zoom, objects draw as plain silhouettes without text or
 * decoration. Labels are unreadable at that scale and text layout is the most
 * expensive part of building a display.
 */
export const LOD_ZOOM_THRESHOLD = 0.3;

/** Per-frame fraction of the remaining distance a physics body closes. */
export const INTERPOLATION_RATE = 0.25;
