"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasObject, PresenceState } from "@infinite-canvas/shared";
import {
  useObjectsSnapshot,
  useRoomHandles,
  useRoomState,
} from "@/components/room/RoomStoreProvider";

const SIZE = 160;
const STORAGE_KEY = "orbitboard-radar-pos";
/** Above this count the radar samples instead of plotting every object. */
const MAX_PLOTTED = 1500;

type Panel = { x: number; y: number };

/** Keeps a panel position inside the current window, matching the drag clamp. */
function clampToWindow(p: Panel): Panel {
  return {
    x: Math.max(8, Math.min(window.innerWidth - 180, p.x)),
    y: Math.max(8, Math.min(window.innerHeight - 200, p.y)),
  };
}

function readStoredPosition(): Panel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Panel).x === "number" &&
      typeof (parsed as Panel).y === "number"
    ) {
      // The saved position was clamped against the window it was dragged in.
      // Restored into a smaller window it can sit entirely off-screen, which
      // made the radar invisible for anyone who once dragged it on a larger
      // display — re-clamp against the window we are actually in.
      return clampToWindow(parsed as Panel);
    }
  } catch {
    // Corrupt or unavailable storage — fall back to the default corner.
  }
  return null;
}

/**
 * Draws the radar to a canvas rather than one SVG node per object, and only at
 * the store's throttled revision rate. Plotting 100k SVG rects at simulation
 * rate was the single most expensive thing in the React tree.
 */
function drawRadar(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  remotes: PresenceState[],
  self: PresenceState | undefined,
  selfColor: string
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);

  let minX = -800;
  let minY = -500;
  let maxX = 800;
  let maxY = 500;
  for (const o of objects) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  for (const r of remotes) {
    if (!r.viewportCenter) continue;
    minX = Math.min(minX, r.viewportCenter.x - 200);
    minY = Math.min(minY, r.viewportCenter.y - 200);
    maxX = Math.max(maxX, r.viewportCenter.x + 200);
    maxY = Math.max(maxY, r.viewportCenter.y + 200);
  }
  const pad = 120;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const worldW = Math.max(400, maxX - minX);
  const worldH = Math.max(300, maxY - minY);
  const scale = Math.min(SIZE / worldW, SIZE / worldH);
  const offsetX = (SIZE - worldW * scale) / 2;
  const offsetY = (SIZE - worldH * scale) / 2;
  const px = (x: number) => offsetX + (x - minX) * scale;
  const py = (y: number) => offsetY + (y - minY) * scale;

  const stride = Math.max(1, Math.ceil(objects.length / MAX_PLOTTED));
  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  for (let i = 0; i < objects.length; i += stride) {
    const o = objects[i];
    ctx.fillRect(
      px(o.x),
      py(o.y),
      Math.max(1.5, o.width * scale),
      Math.max(1.5, o.height * scale)
    );
  }

  const drawViewport = (v: PresenceState["viewport"], color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(
      px(v.x),
      py(v.y),
      Math.max(4, v.width * scale),
      Math.max(4, v.height * scale)
    );
    ctx.globalAlpha = 1;
  };

  const dot = (x: number, y: number, color: string, radius: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(x), py(y), radius, 0, Math.PI * 2);
    ctx.fill();
  };

  if (self?.viewport) {
    drawViewport(self.viewport, selfColor, 1);
    dot(
      self.viewport.x + self.viewport.width / 2,
      self.viewport.y + self.viewport.height / 2,
      selfColor,
      4
    );
  }
  for (const r of remotes) {
    if (r.viewport) drawViewport(r.viewport, r.color, 0.7);
    if (r.viewportCenter) dot(r.viewportCenter.x, r.viewportCenter.y, r.color, 4.5);
  }
}

export function Minimap() {
  const objects = useObjectsSnapshot();
  const remotes = useRoomState((s) => s.remotes);
  const identity = useRoomState((s) => s.identity);
  const { refs } = useRoomHandles();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  // Read once, during initialisation rather than in an effect. Safe because the
  // radar only ever mounts client-side: the room page renders the join form
  // until a guest identity exists, which it never does on the server.
  const [pos, setPos] = useState<Panel | null>(() =>
    typeof window === "undefined" ? null : readStoredPosition()
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const self = refs.bindings?.awareness.getLocalState()?.user as
      | PresenceState
      | undefined;
    drawRadar(ctx, objects, remotes, self, identity.color);
  }, [objects, remotes, identity.color, refs]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPos(clampToWindow({ x: e.clientX - drag.ox, y: e.clientY - drag.oy }));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
          } catch {
            // Position is a convenience; ignore storage failures.
          }
        }
        return p;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const style = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined;

  return (
    <div
      ref={panelRef}
      style={style}
      data-tour="radar"
      className={`ui-card pointer-events-auto absolute z-20 overflow-hidden p-2 ${
        // Parked above the toolbars rather than beside them: the tool strip is
        // centred, so any fixed right offset collides at some viewport width.
        pos === null ? "bottom-[7.5rem] right-3" : ""
      }`}
    >
      <div
        className="mb-1 flex cursor-grab items-center justify-between px-1 active:cursor-grabbing"
        onPointerDown={(e) => {
          const rect = panelRef.current?.getBoundingClientRect();
          if (!rect) return;
          dragRef.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
          if (pos === null) setPos({ x: rect.left, y: rect.top });
          e.preventDefault();
        }}
      >
        <span className="ui-label text-[10px] font-semibold uppercase tracking-wider">
          Radar
        </span>
        <span className="ui-label text-[10px]">{remotes.length + 1} online</span>
      </div>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ width: SIZE, height: SIZE }}
        className="block rounded-lg bg-[var(--canvas-bg)]"
      />
    </div>
  );
}
