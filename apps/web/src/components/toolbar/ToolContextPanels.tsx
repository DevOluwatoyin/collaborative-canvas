"use client";

import { useRoomActions, useRoomState } from "@/components/room/RoomStoreProvider";

export function ToolContextPanels() {
  const tool = useRoomState((s) => s.tool);
  const shapeKind = useRoomState((s) => s.shapeKind);
  const attractMode = useRoomState((s) => s.attractMode);
  const { setShapeKind, setAttractMode, enablePhysicsOnSelected } = useRoomActions();

  if (tool === "draw") {
    return (
      <div className="ui-panel pointer-events-auto mx-auto rounded-xl px-3 py-1.5 text-xs ui-muted">
        Drag to sketch a freehand curve. With a shape selected, the stroke is drawn onto that
        shape.
      </div>
    );
  }

  if (tool === "text") {
    return (
      <div className="ui-panel pointer-events-auto mx-auto rounded-xl px-3 py-1.5 text-xs ui-muted">
        Click empty canvas for text · click a shape to add text inside it · double-click to edit
      </div>
    );
  }

  if (tool === "shape") {
    return (
      <div className="ui-panel pointer-events-auto mx-auto flex gap-1 rounded-xl p-1">
        {(["rect", "ellipse", "triangle"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setShapeKind(k)}
            className={`rounded-lg px-3 py-1 text-xs capitalize ${
              shapeKind === k
                ? "bg-[var(--chip)] font-medium text-[var(--foreground)]"
                : "ui-muted"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    );
  }

  if (tool === "physics") {
    return (
      <div className="ui-panel pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-1 rounded-xl p-1">
        <span className="ui-muted px-2 text-xs">Forces</span>
        {(["none", "attract", "repel"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setAttractMode(m)}
            className={`rounded-lg px-3 py-1 text-xs capitalize ${
              attractMode === m
                ? "bg-[var(--accent)] text-[#06201d]"
                : "ui-muted hover:bg-[var(--panel-hover)]"
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={enablePhysicsOnSelected}
          className="rounded-lg px-3 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
        >
          Enable on selected
        </button>
      </div>
    );
  }

  return null;
}
