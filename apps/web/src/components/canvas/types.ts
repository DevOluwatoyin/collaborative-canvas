import type { CanvasObject, PresenceState, Tool } from "@infinite-canvas/shared";
import type { Container, Graphics, Text } from "pixi.js";

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type WorldBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = { x: number; y: number };

export type HandleCorner = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

/** Interpolated on-screen transform, distinct from the object's CRDT position. */
export type RenderTransform = {
  x: number;
  y: number;
  rotation: number;
};

export type DisplayEntry = {
  root: Container;
  bg: Graphics;
  label?: Text;
  /**
   * What this display was last drawn from. Object references are stable unless a
   * field actually changed, so an identity check is a sufficient dirty test.
   */
  object?: CanvasObject;
  selected?: boolean;
  lod?: boolean;
  renderedX?: number;
  renderedY?: number;
  renderedRotation?: number;
};

export type CanvasEngineCallbacks = {
  onViewportChange: (vp: ViewportState) => void;
  onCursorMove: (world: Point | null) => void;
  onSelect: (ids: string[], additive: boolean) => void;
  onObjectMove: (updates: { id: string; x: number; y: number }[]) => void;
  onObjectMoveEnd: (
    updates: { id: string; x: number; y: number; vx: number; vy: number }[]
  ) => void;
  onObjectRotate: (
    updates: { id: string; rotation: number; cx: number; cy: number }[]
  ) => void;
  onObjectRotateEnd: (
    updates: { id: string; rotation: number; cx: number; cy: number }[]
  ) => void;
  onObjectResize: (
    updates: { id: string; x: number; y: number; width: number; height: number }[]
  ) => void;
  onObjectResizeEnd: (
    updates: { id: string; x: number; y: number; width: number; height: number }[]
  ) => void;
  onPlace: (world: Point, hitId: string | null) => void;
  onFling: (id: string, vx: number, vy: number) => void;
  onEditText: (id: string) => void;
  onStrokeComplete: (points: Point[], targetShapeId: string | null) => void;
};

export type { CanvasObject, PresenceState, Tool };
