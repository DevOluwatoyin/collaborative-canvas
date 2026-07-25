"use client";

import { useRoomActions, useRoomState } from "@/components/room/RoomStoreProvider";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

const STEP = 1.25;

/** Bottom-left zoom readout. Clicking the percentage resets to 100%. */
export function ZoomControl() {
  const zoom = useRoomState((s) => s.zoom);
  const actions = useRoomActions();

  return (
    <div className="ui-card pointer-events-auto flex items-center p-1">
      <button
        type="button"
        className="ui-icon-btn"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() => actions.zoomBy(1 / STEP)}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="ui-icon-btn w-auto px-2 text-[13px] font-medium tabular-nums"
        title="Reset zoom to 100%"
        onClick={() => actions.setZoom(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className="ui-icon-btn"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={() => actions.zoomBy(STEP)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
