import type { CanvasObject } from "@infinite-canvas/shared";
import { downloadBlob } from "./utils";

export function exportJSON(
  objects: CanvasObject[],
  meta: Record<string, unknown>,
  roomId: string
) {
  const payload = {
    version: 1,
    roomId,
    exportedAt: new Date().toISOString(),
    meta,
    objects,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `canvas-${roomId}.json`);
}
