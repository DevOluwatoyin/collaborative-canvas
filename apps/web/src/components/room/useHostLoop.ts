"use client";

import { useEffect } from "react";
import { foldHistory } from "@/lib/yjs/provider";
import { patchYObject } from "@/lib/yjs/objects";
import type { RoomRefs, RoomStore } from "./store";

/** Physics positions are published at ~20Hz; clients interpolate between them. */
const PUBLISH_INTERVAL_MS = 50;
const COMPACT_INTERVAL_MS = 10_000;
const POSITION_EPSILON = 0.5;
const VELOCITY_EPSILON = 0.1;

/**
 * Runs the simulation on the elected host and publishes body positions into the
 * CRDT. Non-host peers keep local bodies aligned with the incoming positions so
 * that when host election changes, whoever takes over starts from the shared
 * state rather than an empty world.
 */
export function useHostLoop(store: RoomStore, refs: RoomRefs) {
  useEffect(() => {
    let raf = 0;
    let lastFrame = performance.now();
    let lastPublish = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - lastFrame;
      lastFrame = now;

      const physics = refs.physics;
      const bindings = refs.bindings;
      if (!physics || !bindings) return;

      const isHost = store.getState().isHost;
      const bodies = [];
      for (const id of refs.physicsIds) {
        const obj = refs.objects.get(id);
        if (obj) bodies.push(obj);
      }
      physics.syncFromObjects(bodies, { forcePositions: !isHost });
      if (!isHost) return;

      physics.step(dt);
      if (now - lastPublish < PUBLISH_INTERVAL_MS) return;
      lastPublish = now;

      const updates = physics.readState();
      bindings.doc.transact(() => {
        for (const [id, next] of updates) {
          const current = refs.objects.get(id);
          if (!current?.physics?.enabled) continue;
          if (
            Math.abs(current.x - next.x) < POSITION_EPSILON &&
            Math.abs(current.y - next.y) < POSITION_EPSILON &&
            Math.abs((current.vx ?? 0) - next.vx) < VELOCITY_EPSILON
          ) {
            continue;
          }
          // Physics motion is intentionally not recorded in the op log: it is
          // derived state, and one op per body per tick would swamp the log.
          patchYObject(bindings.objects, id, {
            x: next.x,
            y: next.y,
            rotation: next.rotation,
            vx: next.vx,
            vy: next.vy,
          });
        }
      });
    };

    raf = requestAnimationFrame(tick);

    const compactor = setInterval(() => {
      if (!store.getState().isHost || !refs.bindings) return;
      foldHistory(refs.bindings);
    }, COMPACT_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(compactor);
    };
  }, [store, refs]);
}
