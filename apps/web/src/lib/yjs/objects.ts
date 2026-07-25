import * as Y from "yjs";
import {
  CANVAS_OBJECT_FIELDS,
  createDefaultPhysics,
  type CanvasObject,
} from "@infinite-canvas/shared";

/**
 * Each canvas object is a Y.Map of individual fields, with `props` as a nested
 * Y.Map. Storing the object as one opaque value would make any concurrent edit
 * last-write-wins across the *whole* object — user A moving a sticky would
 * clobber user B's text edit. Per-field maps let Yjs merge them independently.
 */
export type YProps = Y.Map<unknown>;
export type YObject = Y.Map<unknown>;
export type YObjects = Y.Map<YObject>;

export function createYObject(obj: CanvasObject): YObject {
  const y: YObject = new Y.Map();
  for (const key of CANVAS_OBJECT_FIELDS) {
    const value = obj[key];
    if (value !== undefined) y.set(key, value);
  }
  const props: YProps = new Y.Map();
  for (const [key, value] of Object.entries(obj.props)) {
    if (value !== undefined) props.set(key, value);
  }
  y.set("props", props);
  return y;
}

function readProps(y: YObject): Record<string, unknown> {
  const raw = y.get("props");
  if (raw instanceof Y.Map) return raw.toJSON();
  if (raw && typeof raw === "object") return { ...(raw as Record<string, unknown>) };
  return {};
}

function readString(y: YObject, key: string, fallback = ""): string {
  const value = y.get(key);
  return typeof value === "string" ? value : fallback;
}

/** Materialise a plain CanvasObject so the rest of the app never touches Yjs. */
export function readObject(y: YObject): CanvasObject {
  return {
    id: readString(y, "id"),
    type: (y.get("type") ?? "shape") as CanvasObject["type"],
    x: Number(y.get("x") ?? 0),
    y: Number(y.get("y") ?? 0),
    rotation: Number(y.get("rotation") ?? 0),
    scaleX: Number(y.get("scaleX") ?? 1),
    scaleY: Number(y.get("scaleY") ?? 1),
    width: Number(y.get("width") ?? 0),
    height: Number(y.get("height") ?? 0),
    zIndex: Number(y.get("zIndex") ?? 0),
    props: readProps(y),
    physics: (y.get("physics") as CanvasObject["physics"]) ?? createDefaultPhysics(false),
    vx: Number(y.get("vx") ?? 0),
    vy: Number(y.get("vy") ?? 0),
    createdBy: y.get("createdBy") as string | undefined,
    createdAt: y.get("createdAt") as number | undefined,
    updatedAt: y.get("updatedAt") as number | undefined,
  };
}

export function upsertYObject(objects: YObjects, obj: CanvasObject): void {
  const existing = objects.get(obj.id);
  if (existing) {
    patchYObject(objects, obj.id, obj);
    return;
  }
  objects.set(obj.id, createYObject(obj));
}

/**
 * Applies a shallow patch field-by-field. `props` is merged key-by-key rather
 * than replaced, so two users editing different props of one object both win.
 */
export function patchYObject(
  objects: YObjects,
  id: string,
  patch: Partial<CanvasObject>,
): void {
  const y = objects.get(id);
  if (!y) return;
  const doc = objects.doc;
  const apply = () => {
    for (const key of CANVAS_OBJECT_FIELDS) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value === undefined) continue;
      if (y.get(key) !== value) y.set(key, value);
    }
    if (patch.props) {
      let props = y.get("props");
      if (!(props instanceof Y.Map)) {
        props = new Y.Map();
        y.set("props", props);
      }
      const target = props as YProps;
      for (const [key, value] of Object.entries(patch.props)) {
        if (value === undefined) continue;
        if (target.get(key) !== value) target.set(key, value);
      }
    }
    y.set("updatedAt", Date.now());
  };
  if (doc) doc.transact(apply);
  else apply();
}

export function deleteYObject(objects: YObjects, id: string): void {
  objects.delete(id);
}

export function readAllObjects(objects: YObjects): CanvasObject[] {
  const out: CanvasObject[] = [];
  objects.forEach((y) => out.push(readObject(y)));
  return out;
}

export type ObjectChangeSet = {
  changed: Set<string>;
  removed: Set<string>;
};

/**
 * Maps a deep-observe event batch to the set of object ids touched, so callers
 * can re-materialise only those objects and keep every other object's identity
 * stable. Stable identity is what makes reference-equality dirty checks work in
 * the renderer and in React selectors.
 */
export function changedObjectIds(
  events: Y.YEvent<Y.AbstractType<unknown>>[],
): ObjectChangeSet {
  const changed = new Set<string>();
  const removed = new Set<string>();
  for (const event of events) {
    if (event.path.length === 0) {
      // A change on the objects map itself: object added or deleted.
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          removed.add(key);
          changed.delete(key);
        } else {
          removed.delete(key);
          changed.add(key);
        }
      });
      continue;
    }
    // Anything deeper is a field or prop change on one object.
    const id = String(event.path[0]);
    if (!removed.has(id)) changed.add(id);
  }
  return { changed, removed };
}
