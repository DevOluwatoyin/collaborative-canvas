"use client";

import { useEffect } from "react";
import { foldHistory } from "@/lib/yjs/provider";
import { patchYObject } from "@/lib/yjs/objects";
import { PHYSICS_ORIGIN, type RoomRefs, type RoomStore } from "./store";

/** Physics positions are published at ~20Hz; clients interpolate between them. */
const PUBLISH_INTERVAL_MS = 50;
const COMPACT_INTERVAL_MS = 10_000;
const POSITION_EPSILON = 0.5;
/** Gentle enough that objects drift rather than plummet off-screen. */
const GRAVITY_SCALE = 0.4;
const VELOCITY_EPSILON = 0.1;
/** Fallback tick when the tab is hidden and rAF is paused. */
const BACKGROUND_TICK_MS = 50;

/**
 * Runs the simulation on the elected host and publishes body positions into the
 * CRDT. Non-host peers keep local bodies aligned with the incoming positions so
 * that when host election changes, whoever takes over starts from the shared
 * state rather than an empty world.
 */
export function useHostLoop(store: RoomStore, refs: RoomRefs) {
  useEffect(() => {
    let raf = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    let lastFrame = performance.now();
    let lastPublish = 0;

    const tick = (now: number) => {
      const dt = now - lastFrame;
      lastFrame = now;

      const physics = refs.physics;
      const bindings = refs.bindings;
      if (!physics || !bindings) return;

      const { isHost, attractMode, gravity } = store.getState();
      // Force settings are replicated, so re-applying them each tick keeps the
      // host in step with whoever changed them.
      physics.setAttractMode(attractMode);
      physics.setGravity(gravity ? GRAVITY_SCALE : 0);

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
      // PHYSICS_ORIGIN keeps simulation writes out of the undo stack: the
      // UndoManager only tracks null-origin (direct user) transactions.
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
      }, PHYSICS_ORIGIN);
    };

    /**
     * Browsers pause requestAnimationFrame in hidden tabs. Because only the
     * elected host simulates, a host whose tab was backgrounded froze physics
     * for everyone in the room. When hidden we fall back to a timer, which keeps
     * running (throttled) so the simulation degrades instead of stopping.
     */
    const stopScheduler = () => {
      if (raf) cancelAnimationFrame(raf);
      if (interval) clearInterval(interval);
      raf = 0;
      interval = null;
    };

    const startScheduler = () => {
      stopScheduler();
      if (document.visibilityState === "visible") {
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          tick(now);
        };
        raf = requestAnimationFrame(frame);
      } else {
        interval = setInterval(() => tick(performance.now()), BACKGROUND_TICK_MS);
      }
    };

    startScheduler();
    document.addEventListener("visibilitychange", startScheduler);

    const compactor = setInterval(() => {
      if (!store.getState().isHost || !refs.bindings) return;
      foldHistory(refs.bindings);
    }, COMPACT_INTERVAL_MS);

    return () => {
      stopScheduler();
      document.removeEventListener("visibilitychange", startScheduler);
      clearInterval(compactor);
    };
  }, [store, refs]);
}
