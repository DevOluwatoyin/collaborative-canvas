"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import { propNumber, propString, type CanvasObject } from "@infinite-canvas/shared";
import type { CanvasEngine } from "@/components/canvas/CanvasEngine";

/** Window in which a focus loss counts as fallout from the opening click. */
const FOCUS_GRACE_MS = 600;

/**
 * Text editing keeps its own local value rather than reading the object back
 * from the store.
 *
 * Room state is deliberately throttled (~5Hz) so simulation traffic cannot drive
 * React renders, but a controlled textarea fed from that snapshot lags a
 * keystroke behind and fights the caret position — typing appeared broken. The
 * textarea owns the value while it is open and pushes each edit into the CRDT,
 * so remote peers still see every keystroke.
 */
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
  const [value, setValue] = useState(() => propString(obj.props, "text"));
  const ref = useRef<HTMLTextAreaElement>(null);
  const openedAt = useRef(0);

  // Select-all on open so placeholder copy ("Text", "New idea…") is replaced by
  // the first keystroke instead of being typed around.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    openedAt.current = performance.now();
    node.focus();
    node.select();
  }, []);

  /**
   * The click that creates a text object finishes *after* this editor mounts,
   * and its pointerup on the canvas pulls focus back to <body>. That fired blur
   * and closed the editor a frame after it opened — leaving keystrokes to fall
   * through to the canvas shortcuts. A blur with no relatedTarget (focus going
   * nowhere, rather than to something the user clicked) within that window is
   * treated as the tail of the opening gesture and focus is reclaimed.
   */
  function handleBlur(e: FocusEvent<HTMLTextAreaElement>) {
    const spurious =
      e.relatedTarget === null && performance.now() - openedAt.current < FOCUS_GRACE_MS;
    if (spurious) {
      ref.current?.focus();
      return;
    }
    onClose();
  }

  const zoom = engine.viewport.zoom;
  const isShape = obj.type === "shape";

  function commit(next: string) {
    setValue(next);
    onChange(next);
  }

  return (
    <textarea
      ref={ref}
      value={value}
      spellCheck={false}
      onChange={(e) => commit(e.target.value)}
      onBlur={handleBlur}
      // The room listens for keys globally (Delete clears the selection, single
      // letters switch tools). Stopping propagation keeps typing in the editor
      // from reaching those handlers.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        if (e.key === "Enter" && !e.shiftKey && obj.type !== "sticky") {
          e.preventDefault();
          onClose();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-30 resize-none rounded-md border-2 border-[var(--ui-selected)] p-2 shadow-lg outline-none"
      style={{
        left: obj.x * zoom + engine.viewport.x,
        top: obj.y * zoom + engine.viewport.y,
        width: Math.max(120, obj.width * zoom),
        height: Math.max(36, obj.height * zoom),
        fontSize: propNumber(obj.props, "fontSize", isShape ? 18 : 24) * zoom,
        fontFamily: obj.type === "sticky" ? "Georgia, serif" : "inherit",
        color: isShape
          ? propString(obj.props, "textColor", "#ffffff")
          : propString(obj.props, "color", "#1a2330"),
        background: isShape ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.97)",
        textAlign: isShape ? "center" : "left",
      }}
    />
  );
}
