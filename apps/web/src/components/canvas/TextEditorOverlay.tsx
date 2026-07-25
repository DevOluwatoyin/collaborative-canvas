"use client";

import { propNumber, propString, type CanvasObject } from "@infinite-canvas/shared";
import type { CanvasEngine } from "@/components/canvas/CanvasEngine";

export function TextEditorOverlay({
  obj,
  engine,
  onChange,
  onClose,
}: {
  obj: CanvasObject;
  engine: CanvasEngine;
  onChange: (text: string) => void;
  onClose: () => void;
}) {
  const screen = {
    x: obj.x * engine.viewport.zoom + engine.viewport.x,
    y: obj.y * engine.viewport.zoom + engine.viewport.y,
  };
  const w = Math.max(120, obj.width * engine.viewport.zoom);
  const h = Math.max(36, obj.height * engine.viewport.zoom);
  const isShape = obj.type === "shape";
  const value = propString(obj.props, "text");

  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter" && !e.shiftKey && obj.type === "text") {
          e.preventDefault();
          onClose();
        }
      }}
      className="absolute z-30 resize-none rounded-md border-2 border-[var(--accent)] bg-white/95 p-2 text-[var(--foreground)] shadow-lg outline-none"
      style={{
        left: screen.x,
        top: screen.y,
        width: w,
        height: h,
        fontSize:
          propNumber(obj.props, "fontSize", isShape ? 18 : 24) * engine.viewport.zoom,
        color: isShape
          ? propString(obj.props, "textColor", "#ffffff")
          : propString(obj.props, "color", "#1a2330"),
        background: isShape ? "transparent" : "rgba(255,255,255,0.95)",
        textAlign: isShape ? "center" : "left",
      }}
    />
  );
}
