import { createDefaultPhysics } from "@infinite-canvas/shared";
import { nanoid } from "nanoid";
import { appendHistory, type RoomBindings } from "@/lib/yjs/provider";
import { patchYObject, readObject } from "@/lib/yjs/objects";
import type { PhysicsBridge } from "@/lib/physics/engine";
import type { Actor } from "./core";

export function flingRoomObject(
  bindings: RoomBindings,
  physics: PhysicsBridge | null,
  actor: Actor,
  id: string,
  vx: number,
  vy: number
) {
  const y = bindings.objects.get(id);
  if (!y) return;
  const current = readObject(y);
  const nextPhysics = {
    ...(current.physics ?? createDefaultPhysics(true)),
    enabled: true,
  };
  bindings.doc.transact(() => {
    patchYObject(bindings.objects, id, { physics: nextPhysics, vx, vy });
    appendHistory(bindings.history, {
      id: `h-${nanoid(10)}`,
      type: "physicsImpulse",
      objectId: id,
      payload: { vx, vy, x: current.x, y: current.y },
      userId: actor.id,
      username: actor.username,
      timestamp: Date.now(),
    });
  });
  physics?.applyImpulse(id, vx, vy);
}
