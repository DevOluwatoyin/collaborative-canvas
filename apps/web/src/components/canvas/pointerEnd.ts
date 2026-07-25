import type { FederatedPointerEvent } from "pixi.js";
import { normalizeRect } from "./geometry";
import type { InteractionHost } from "./interactionHost";
import type { PointerSession } from "./pointerSession";

export function handlePointerEnd(
  e: FederatedPointerEvent,
  host: InteractionHost,
  session: PointerSession
) {
  if (session.panning) session.panning = false;

  if (session.drawing) {
    const stroke = session.drawing;
    session.drawing = null;
    host.getDrawPreviewGfx().clear();
    if (stroke.points.length >= 2) {
      host.callbacks.onStrokeComplete(stroke.points, stroke.targetShapeId);
    }
    return;
  }

  if (session.resizing) {
    const updates: {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    for (const id of host.getSelectedIds()) {
      const obj = host.getObject(id);
      if (!obj) continue;
      updates.push({
        id: obj.id,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
      });
    }
    host.callbacks.onObjectResizeEnd(updates);
    session.resizing = null;
    return;
  }

  if (session.marquee) {
    const { x0, y0, x1, y1 } = session.marquee;
    if (Math.abs(x1 - x0) > 4 || Math.abs(y1 - y0) > 4) {
      host.callbacks.onSelect(
        host.queryRect(normalizeRect(x0, y0, x1, y1)),
        e.shiftKey
      );
    }
    session.marquee = null;
    host.getMarqueeGfx().clear();
    return;
  }

  const drag = session.dragging;
  if (drag) {
    const world = host.screenToWorld(e.global.x, e.global.y);
    const dx = world.x - drag.startWorld.x;
    const dy = world.y - drag.startWorld.y;
    const { ids, origins, vx, vy } = drag;
    session.dragging = null;
    const updates: {
      id: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
    }[] = [];
    for (const id of ids) {
      const origin = origins.get(id);
      if (!origin) continue;
      updates.push({ id, x: origin.x + dx, y: origin.y + dy, vx, vy });
    }
    host.callbacks.onObjectMoveEnd(updates);
    if (
      host.getTool() === "physics" &&
      ids.length === 1 &&
      (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5)
    ) {
      host.callbacks.onFling(ids[0], vx * 8, vy * 8);
    }
  }
}
