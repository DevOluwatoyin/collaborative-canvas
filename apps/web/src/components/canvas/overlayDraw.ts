import type { Container, Graphics, Text } from "pixi.js";
import { HANDLE_SIZE, SELECTION_COLOR } from "./constants";
import {
  handlePositions,
  rotateHandlePosition,
  type ObjectLookup,
} from "./geometry";
import type { PathPoint } from "@infinite-canvas/shared";
import type { Rect } from "./types";
export function drawMarquee(
  gfx: Graphics,
  marquee: { x0: number; y0: number; x1: number; y1: number } | null,
  zoom: number
) {
  gfx.clear();
  if (!marquee) return;
  const { x0, y0, x1, y1 } = marquee;
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  gfx.rect(x, y, w, h);
  gfx.fill({ color: 0x3dd6c6, alpha: 0.12 });
  gfx.stroke({ width: 1 / zoom, color: SELECTION_COLOR });
}

/**
 * Floating caption above the selection telling the user a double-click starts
 * editing. Editing was otherwise undiscoverable: nothing about a selected note
 * suggests a second click does something different from the first.
 *
 * Sized in screen pixels by counter-scaling, so it stays readable at any zoom.
 */
export function drawEditHint(
  container: Container,
  label: Text,
  background: Graphics,
  bounds: Rect | null,
  zoom: number,
  visible: boolean
) {
  container.visible = visible;
  if (!visible || !bounds) return;

  const padX = 7;
  const padY = 3;
  const width = label.width + padX * 2;
  const height = label.height + padY * 2;

  background.clear();
  background.roundRect(0, 0, width, height, height / 2);
  background.fill({ color: SELECTION_COLOR, alpha: 0.95 });
  label.position.set(padX, padY);

  container.scale.set(1 / zoom);
  container.position.set(
    bounds.x + bounds.width / 2 - width / (2 * zoom),
    bounds.y - (height + 10) / zoom
  );
}

/**
 * Rotation grip: a stem rising from the top edge to a round knob. Drawn in world
 * space but sized from the zoom so it stays a constant on-screen target.
 */
function drawRotateGrip(gfx: Graphics, bounds: Rect, zoom: number) {
  const grip = rotateHandlePosition(bounds, zoom);
  const radius = 5 / zoom;
  gfx.moveTo(bounds.x + bounds.width / 2, bounds.y);
  gfx.lineTo(grip.x, grip.y + radius);
  gfx.stroke({ width: 1.25 / zoom, color: SELECTION_COLOR, alpha: 0.85 });
  gfx.circle(grip.x, grip.y, radius);
  gfx.fill(0xffffff);
  gfx.stroke({ width: 1.5 / zoom, color: SELECTION_COLOR });
}

export function drawSelectionHandles(
  gfx: Graphics,
  selectedIds: Set<string>,
  lookup: ObjectLookup,
  bounds: Rect | null,
  zoom: number,
  multi: boolean
) {
  gfx.clear();
  if (!bounds || selectedIds.size === 0) return;
  const size = HANDLE_SIZE / zoom;
  drawRotateGrip(gfx, bounds, zoom);

  for (const id of selectedIds) {
    const obj = lookup.getObject(id);
    if (!obj) continue;
    gfx.rect(obj.x, obj.y, obj.width, obj.height);
    gfx.stroke({ width: 1.25 / zoom, color: SELECTION_COLOR, alpha: 0.85 });
  }

  gfx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  gfx.stroke({
    width: 1.75 / zoom,
    color: SELECTION_COLOR,
    alpha: multi ? 1 : 0.5,
  });
  for (const h of handlePositions(bounds)) {
    gfx.rect(h.x - size / 2, h.y - size / 2, size, size);
    gfx.fill(0xffffff);
    gfx.stroke({ width: 1 / zoom, color: SELECTION_COLOR });
  }
}

export function drawStrokePreview(
  gfx: Graphics,
  points: PathPoint[] | null,
  zoom: number
) {
  gfx.clear();
  if (!points || points.length < 2) return;
  gfx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    gfx.lineTo(points[i].x, points[i].y);
  }
  gfx.stroke({
    width: 3 / zoom,
    color: 0x1a2330,
    cap: "round",
    join: "round",
  });
}

export function drawWorldGrid(
  gfx: Graphics,
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
  step: number,
  color: number
) {
  gfx.clear();
  const startX = Math.floor(bounds.x / step) * step - step;
  const startY = Math.floor(bounds.y / step) * step - step;
  const endX = bounds.x + bounds.width + step;
  const endY = bounds.y + bounds.height + step;
  gfx.setStrokeStyle({ width: 1 / zoom, color, alpha: 1 });
  for (let x = startX; x < endX; x += step) {
    gfx.moveTo(x, startY);
    gfx.lineTo(x, endY);
  }
  for (let y = startY; y < endY; y += step) {
    gfx.moveTo(startX, y);
    gfx.lineTo(endX, y);
  }
  gfx.stroke();
}
