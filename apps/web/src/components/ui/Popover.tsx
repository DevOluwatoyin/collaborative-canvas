"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Placement = "top" | "top-start" | "top-end" | "bottom-start" | "bottom-end";

/**
 * Placement is explicit rather than auto-flipped: every popover here is anchored
 * to a fixed corner of the screen, so the correct side is known statically. Pick
 * the variant that opens *away* from the nearest viewport edge — a right-aligned
 * menu on a left-hand button overflows off-screen.
 */
const PLACEMENT_CLASS: Record<Placement, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  "top-start": "bottom-full left-0 mb-2",
  "top-end": "bottom-full right-0 mb-2",
  "bottom-start": "top-full left-0 mt-2",
  "bottom-end": "top-full right-0 mt-2",
};

/**
 * Click-to-open floating panel. Closes on outside pointerdown, on Escape, and
 * whenever the content signals it is done (so picking an item dismisses it).
 */
export function Popover({
  label,
  icon,
  placement = "top",
  panelClassName = "",
  buttonClassName = "ui-icon-btn",
  selected = false,
  children,
}: {
  label: string;
  icon: ReactNode;
  placement?: Placement;
  panelClassName?: string;
  buttonClassName?: string;
  selected?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-selected={selected || open ? "true" : undefined}
        className={buttonClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className={`ui-card absolute z-50 p-1.5 ${PLACEMENT_CLASS[placement]} ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
