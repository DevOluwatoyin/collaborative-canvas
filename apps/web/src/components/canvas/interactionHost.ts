import type { Application, Graphics } from "pixi.js";
import type { CanvasObject, Tool } from "@infinite-canvas/shared";
import type { CanvasEngineCallbacks, Point, Rect, ViewportState } from "./types";

/** Mutable host surface the interaction layer drives. */
export type InteractionHost = {
  app: Application;
  viewport: ViewportState;
  callbacks: CanvasEngineCallbacks;
  getTool: () => Tool;
  getSelectedIds: () => Set<string>;
  getObject: (id: string) => CanvasObject | undefined;
  /** Spatial-index backed lookups: view-proportional, not O(all objects). */
  hitTest: (wx: number, wy: number) => CanvasObject | null;
  queryRect: (rect: Rect) => string[];
  isOverlayActive: () => boolean;
  screenToWorld: (sx: number, sy: number) => Point;
  applyViewport: () => void;
  redrawGrid: () => void;
  redrawHandles: () => void;
  getDrawPreviewGfx: () => Graphics;
  getMarqueeGfx: () => Graphics;
};
