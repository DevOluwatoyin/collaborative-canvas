import Matter from "matter-js";
import type { CanvasObject } from "@infinite-canvas/shared";

const { Engine, Bodies, Body, World, Composite } = Matter;

export type BodyState = {
  x: number;
  y: number;
  rotation: number;
  vx: number;
  vy: number;
};

export type PhysicsBridge = {
  engine: Matter.Engine;
  syncFromObjects: (
    objects: CanvasObject[],
    opts?: { forcePositions?: boolean; pinned?: ReadonlySet<string> }
  ) => void;
  applyImpulse: (id: string, vx: number, vy: number) => void;
  /** Advances the simulation. Reading results is a separate call. */
  step: (dtMs: number) => void;
  readState: () => Map<string, BodyState>;
  setAttractMode: (mode: "none" | "attract" | "repel") => void;
  /** Downward gravity scale; 0 leaves bodies floating in free space. */
  setGravity: (scale: number) => void;
  destroy: () => void;
  getBody: (id: string) => Matter.Body | undefined;
};

export function createPhysicsBridge(): PhysicsBridge {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const bodies = new Map<string, Matter.Body>();
  let attractMode: "none" | "attract" | "repel" = "none";

  function ensureBody(obj: CanvasObject, forcePosition: boolean): Matter.Body | null {
    if (!obj.physics?.enabled) {
      const existing = bodies.get(obj.id);
      if (existing) {
        World.remove(engine.world, existing);
        bodies.delete(obj.id);
      }
      return null;
    }

    let body = bodies.get(obj.id);
    if (!body) {
      body = Bodies.rectangle(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
        Math.max(8, obj.width),
        Math.max(8, obj.height),
        {
          frictionAir: obj.physics.frictionAir ?? 0.02,
          restitution: 0.65,
          density: (obj.physics.mass ?? 1) * 0.001,
          label: obj.id,
        }
      );
      if (obj.vx || obj.vy) {
        Body.setVelocity(body, { x: obj.vx ?? 0, y: obj.vy ?? 0 });
      }
      World.add(engine.world, body);
      bodies.set(obj.id, body);
    } else if (forcePosition) {
      Body.setPosition(body, {
        x: obj.x + obj.width / 2,
        y: obj.y + obj.height / 2,
      });
      Body.setAngle(body, (obj.rotation * Math.PI) / 180);
      Body.setVelocity(body, { x: obj.vx ?? 0, y: obj.vy ?? 0 });
    }
    return body;
  }

  function syncFromObjects(
    objects: CanvasObject[],
    opts?: { forcePositions?: boolean; pinned?: ReadonlySet<string> }
  ) {
    const seen = new Set<string>();
    const force = opts?.forcePositions ?? false;
    const pinned = opts?.pinned;
    for (const obj of objects) {
      seen.add(obj.id);
      // A pinned body is being dragged: snap it to the incoming position and
      // hold it still, so the simulation cannot fight the pointer.
      const body = ensureBody(obj, force || pinned?.has(obj.id) === true);
      if (body && pinned?.has(obj.id)) {
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
      }
    }
    for (const [id, body] of bodies) {
      if (!seen.has(id)) {
        World.remove(engine.world, body);
        bodies.delete(id);
      }
    }
  }

  function applyImpulse(id: string, vx: number, vy: number) {
    const body = bodies.get(id);
    if (!body) return;
    Body.setVelocity(body, { x: vx, y: vy });
  }

  function applyForces() {
    if (attractMode === "none") return;
    const all = Array.from(bodies.values());
    const strength = attractMode === "attract" ? 0.00008 : -0.00008;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = strength * a.mass * b.mass;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        Body.applyForce(a, a.position, { x: fx, y: fy });
        Body.applyForce(b, b.position, { x: -fx, y: -fy });
      }
    }
  }

  function step(dtMs: number) {
    applyForces();
    Engine.update(engine, Math.min(dtMs, 32));
  }

  function readState(): Map<string, BodyState> {
    const updates = new Map<string, BodyState>();
    for (const [id, body] of bodies) {
      const w = body.bounds.max.x - body.bounds.min.x;
      const h = body.bounds.max.y - body.bounds.min.y;
      updates.set(id, {
        x: body.position.x - w / 2,
        y: body.position.y - h / 2,
        rotation: (body.angle * 180) / Math.PI,
        vx: body.velocity.x,
        vy: body.velocity.y,
      });
    }
    return updates;
  }

  return {
    engine,
    syncFromObjects,
    applyImpulse,
    step,
    readState,
    setGravity: (scale) => {
      engine.gravity.y = scale;
    },
    setAttractMode: (mode) => {
      attractMode = mode;
    },
    destroy: () => {
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      bodies.clear();
    },
    getBody: (id) => bodies.get(id),
  };
}
