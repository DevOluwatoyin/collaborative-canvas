import { createCanvasObject } from "@infinite-canvas/shared";
import type { RoomBindings } from "@/lib/yjs/provider";
import { upsertYObject } from "@/lib/yjs/objects";
import type { Actor } from "./core";

/**
 * Load generator for the object-count performance target. Goes through the
 * normal object path so bulk objects are structured exactly like user-created
 * ones, in one transaction so peers receive a single update rather than N.
 */
export function spawnBulkObjects(
  bindings: RoomBindings,
  actor: Actor,
  count: number
): void {
  const colors = ["#3B82F6", "#E85D4C", "#2BB673", "#F59E0B", "#EC4899", "#14B8A6"];
  const spread = Math.max(2000, Math.sqrt(count) * 220);
  const batch = Date.now().toString(36);
  bindings.doc.transact(() => {
    for (let i = 0; i < count; i++) {
      const obj = createCanvasObject({
        id: `bulk-${batch}-${i}`,
        type: "shape",
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread * 0.75,
        rotation: Math.random() * 40 - 20,
        width: 40 + Math.random() * 60,
        height: 40 + Math.random() * 60,
        zIndex: i,
        createdBy: actor.id,
        props: {
          shape: Math.random() > 0.5 ? "rect" : "ellipse",
          fill: colors[i % colors.length],
          text: "",
        },
      });
      upsertYObject(bindings.objects, obj);
    }
  });
}
