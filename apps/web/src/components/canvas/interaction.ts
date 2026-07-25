import type { FederatedPointerEvent } from "pixi.js";
import { handlePointerDown, handlePointerMove } from "./pointerHandlers";
import { handlePointerEnd } from "./pointerEnd";
import { createPointerSession } from "./pointerSession";
import type { InteractionHost } from "./interactionHost";

export type { InteractionHost } from "./interactionHost";

export class InteractionController {
  private host: InteractionHost;
  private session = createPointerSession();
  private bound = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor(host: InteractionHost) {
    this.host = host;
  }

  bind() {
    if (this.bound) return;
    this.bound = true;
    const { app } = this.host;
    const stage = app.stage;
    this.canvas = app.canvas;

    stage.on("pointerdown", this.onPointerDown);
    stage.on("pointermove", this.onPointerMove);
    stage.on("pointerup", this.onPointerEnd);
    stage.on("pointerupoutside", this.onPointerEnd);
    stage.on("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  unbind() {
    if (!this.bound) return;
    this.bound = false;
    const stage = this.host.app.stage;
    stage.off("pointerdown", this.onPointerDown);
    stage.off("pointermove", this.onPointerMove);
    stage.off("pointerup", this.onPointerEnd);
    stage.off("pointerupoutside", this.onPointerEnd);
    stage.off("pointerleave", this.onPointerLeave);
    this.canvas?.removeEventListener("wheel", this.onWheel);
    this.canvas = null;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onPointerDown = (e: FederatedPointerEvent) => {
    handlePointerDown(e, this.host, this.session);
  };

  private onPointerMove = (e: FederatedPointerEvent) => {
    handlePointerMove(e, this.host, this.session);
  };

  private onPointerEnd = (e: FederatedPointerEvent) => {
    handlePointerEnd(e, this.host, this.session);
  };

  private onPointerLeave = () => {
    this.host.callbacks.onCursorMove(null);
  };

  private onWheel = (ev: WheelEvent) => {
    const h = this.host;
    ev.preventDefault();
    const rect = h.app.canvas.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    if (ev.ctrlKey || ev.metaKey) {
      const before = h.screenToWorld(sx, sy);
      h.viewport.zoom = Math.min(
        8,
        Math.max(0.05, h.viewport.zoom * Math.exp(-ev.deltaY * 0.01))
      );
      h.applyViewport();
      const after = h.screenToWorld(sx, sy);
      h.viewport.x += (after.x - before.x) * h.viewport.zoom;
      h.viewport.y += (after.y - before.y) * h.viewport.zoom;
    } else {
      h.viewport.x -= ev.deltaX;
      h.viewport.y -= ev.deltaY;
    }
    h.applyViewport();
    h.callbacks.onViewportChange({ ...h.viewport });
    h.redrawGrid();
    h.redrawHandles();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
      this.session.spaceDown = true;
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") this.session.spaceDown = false;
  };
}
