import type { FederatedPointerEvent } from "pixi.js";
import { propString, type CanvasObject, type Tool } from "@infinite-canvas/shared";
import { HANDLE_SIZE, ROTATE_HIT_PAD } from "./constants";
import {
  angleFromCenter,
  computeGroupResize,
  computeRotation,
  cursorForHandle,
  hitHandleAt,
  hitRotateHandle,
  selectionBoundsFromIds,
} from "./geometry";
import { drawMarquee, drawStrokePreview } from "./overlayDraw";
import type { Point, Rect } from "./types";
import type { InteractionHost } from "./interactionHost";
import type { PointerSession } from "./pointerSession";

export function handlePointerDown(
  e: FederatedPointerEvent,
  host: InteractionHost,
  session: PointerSession
) {
  if (host.isOverlayActive()) return;
  const world = host.screenToWorld(e.global.x, e.global.y);
  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
  const tool = host.getTool();
  const selectedIds = host.getSelectedIds();

  if (tool === "pan" || session.spaceDown || e.button === 1) {
    session.panning = true;
    session.panStart = {
      x: e.global.x,
      y: e.global.y,
      vx: host.viewport.x,
      vy: host.viewport.y,
    };
    return;
  }

  if (tool === "draw") {
    let targetShapeId: string | null = null;
    if (selectedIds.size === 1) {
      const [onlyId] = selectedIds;
      const sel = host.getObject(onlyId);
      if (sel?.type === "shape") targetShapeId = sel.id;
    }
    session.drawing = { points: [world], targetShapeId };
    drawStrokePreview(host.getDrawPreviewGfx(), session.drawing.points, host.viewport.zoom);
    return;
  }

  const bounds = selectionBoundsFromIds(selectedIds, host);

  if (
    tool === "select" &&
    bounds &&
    hitRotateHandle(bounds, world.x, world.y, host.viewport.zoom, ROTATE_HIT_PAD / host.viewport.zoom)
  ) {
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const origins = new Map<string, { rotation: number; cx: number; cy: number }>();
    for (const id of selectedIds) {
      const o = host.getObject(id);
      if (o) {
        origins.set(id, {
          rotation: o.rotation,
          cx: o.x + o.width / 2,
          cy: o.y + o.height / 2,
        });
      }
    }
    session.rotating = {
      center,
      startAngle: angleFromCenter(center, world),
      origins,
    };
    return;
  }

  const handle = hitHandleAt(bounds, world.x, world.y, HANDLE_SIZE / host.viewport.zoom);
  if (handle && tool === "select" && bounds) {
    const origins = new Map<string, Rect>();
    for (const id of selectedIds) {
      const o = host.getObject(id);
      if (o) origins.set(id, { x: o.x, y: o.y, width: o.width, height: o.height });
    }
    session.resizing = {
      corner: handle.corner,
      startBounds: bounds,
      startWorld: world,
      origins,
    };
    return;
  }

  if (isPlacementTool(tool)) {
    const hit = host.hitTest(world.x, world.y);
    host.callbacks.onPlace(world, hit?.id ?? null);
    return;
  }

  const hit = host.hitTest(world.x, world.y);
  const now = performance.now();
  if (hit && isDoubleClickEdit(session, hit, now)) {
    host.callbacks.onEditText(hit.id);
    session.lastClick = { id: null, t: 0 };
    return;
  }
  session.lastClick = { id: hit?.id ?? null, t: now };

  if (hit) {
    beginDrag(host, session, hit, selectedIds, world, additive);
  } else if (tool === "select") {
    if (!additive) host.callbacks.onSelect([], false);
    session.marquee = { x0: world.x, y0: world.y, x1: world.x, y1: world.y };
    drawMarquee(host.getMarqueeGfx(), session.marquee, host.viewport.zoom);
  }
}

export function handlePointerMove(
  e: FederatedPointerEvent,
  host: InteractionHost,
  session: PointerSession
) {
  const world = host.screenToWorld(e.global.x, e.global.y);
  host.callbacks.onCursorMove(world);
  updateHoverCursor(host, session, world);

  if (session.panning) {
    host.viewport.x = session.panStart.vx + (e.global.x - session.panStart.x);
    host.viewport.y = session.panStart.vy + (e.global.y - session.panStart.y);
    host.applyViewport();
    host.callbacks.onViewportChange({ ...host.viewport });
    host.redrawGrid();
    return;
  }

  if (session.drawing) {
    const points = session.drawing.points;
    const last = points[points.length - 1];
    if (Math.hypot(world.x - last.x, world.y - last.y) > 1.5) {
      points.push(world);
      drawStrokePreview(host.getDrawPreviewGfx(), points, host.viewport.zoom);
    }
    return;
  }

  if (session.rotating) {
    // Shift snaps to 15-degree steps, the usual convention for angle gestures.
    const updates = computeRotation(session.rotating, world, e.shiftKey);
    host.callbacks.onObjectRotate(updates);
    host.redrawHandles();
    return;
  }

  if (session.resizing) {
    const updates = computeGroupResize(
      session.resizing.corner,
      session.resizing.startBounds,
      session.resizing.startWorld,
      world,
      session.resizing.origins
    );
    host.callbacks.onObjectResize(updates);
    host.redrawHandles();
    return;
  }

  if (session.marquee) {
    session.marquee.x1 = world.x;
    session.marquee.y1 = world.y;
    drawMarquee(host.getMarqueeGfx(), session.marquee, host.viewport.zoom);
    return;
  }

  const drag = session.dragging;
  if (drag) {
    const dx = world.x - drag.startWorld.x;
    const dy = world.y - drag.startWorld.y;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    drag.vx = ((world.x - drag.lastX) / dt) * 16;
    drag.vy = ((world.y - drag.lastY) / dt) * 16;
    drag.lastX = world.x;
    drag.lastY = world.y;
    drag.lastT = now;
    const updates: { id: string; x: number; y: number }[] = [];
    for (const id of drag.ids) {
      const origin = drag.origins.get(id);
      if (!origin) continue;
      updates.push({ id, x: origin.x + dx, y: origin.y + dy });
    }
    host.callbacks.onObjectMove(updates);
    host.redrawHandles();
  }
}

/**
 * Reflects what a press would do at the current position: a resize arrow on the
 * selection handles, a move cursor over an object, grab while panning. Without
 * this the resize handles were invisible affordances — you had to already know
 * the edges were draggable.
 */
function updateHoverCursor(
  host: InteractionHost,
  session: PointerSession,
  world: Point
) {
  if (session.dragging || session.resizing || session.rotating || session.marquee) {
    return;
  }

  const tool = host.getTool();
  if (tool === "pan" || session.spaceDown) {
    host.setCursor(session.panning ? "grabbing" : "grab");
    return;
  }
  if (tool === "draw") {
    host.setCursor("crosshair");
    return;
  }
  if (isPlacementTool(tool)) {
    host.setCursor("copy");
    return;
  }

  const selectedIds = host.getSelectedIds();
  if (selectedIds.size > 0) {
    const bounds = selectionBoundsFromIds(selectedIds, host);
    if (
      hitRotateHandle(bounds, world.x, world.y, host.viewport.zoom, ROTATE_HIT_PAD / host.viewport.zoom)
    ) {
      host.setCursor("grab");
      return;
    }
    const handle = hitHandleAt(
      bounds,
      world.x,
      world.y,
      HANDLE_SIZE / host.viewport.zoom
    );
    if (handle) {
      host.setCursor(cursorForHandle(handle.corner));
      return;
    }
  }

  host.setCursor(host.hitTest(world.x, world.y) ? "move" : "default");
}

function isPlacementTool(tool: Tool) {
  return (
    tool === "text" ||
    tool === "shape" ||
    tool === "sticky" ||
    tool === "image" ||
    tool === "audio"
  );
}

function isDoubleClickEdit(
  session: PointerSession,
  hit: CanvasObject,
  now: number
) {
  return (
    session.lastClick.id === hit.id &&
    now - session.lastClick.t < 350 &&
    (hit.type === "text" ||
      hit.type === "sticky" ||
      hit.type === "shape" ||
      propString(hit.props, "text").length > 0)
  );
}

function beginDrag(
  host: InteractionHost,
  session: PointerSession,
  hit: CanvasObject,
  selectedIds: Set<string>,
  world: Point,
  additive: boolean
) {
  const already = selectedIds.has(hit.id);
  let nextIds: string[];
  if (additive) {
    nextIds = already
      ? [...selectedIds].filter((id) => id !== hit.id)
      : [...selectedIds, hit.id];
  } else if (already && selectedIds.size > 1) {
    nextIds = [...selectedIds];
  } else {
    nextIds = [hit.id];
  }
  host.callbacks.onSelect(nextIds, additive);
  const moveIds = additive || already ? nextIds : [hit.id];
  const origins = new Map<string, Point>();
  for (const id of moveIds) {
    const o = host.getObject(id);
    if (o) origins.set(id, { x: o.x, y: o.y });
  }
  session.dragging = {
    ids: moveIds,
    origins,
    startWorld: world,
    lastX: world.x,
    lastY: world.y,
    lastT: performance.now(),
    vx: 0,
    vy: 0,
  };
}
