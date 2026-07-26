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
type YProps = Y.Map<unknown>;
type YObject = Y.Map<unknown>;
export type YObjects = Y.Map<YObject>;

/**
 * Duck-type check so we still recognise Y.Maps when the bundler has loaded more
 * than one copy of yjs (instanceof fails across constructor realms).
 */
function isYMap(value: unknown): value is Y.Map<unknown> {
  return (
    value instanceof Y.Map ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as Y.Map<unknown>).get === "function" &&
      typeof (value as Y.Map<unknown>).set === "function" &&
      typeof (value as Y.Map<unknown>).toJSON === "function")
  );
}

function createYObject(obj: CanvasObject): YObject {
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

/**
 * Field accessor that works for both the current per-field Y.Map layout and the
 * legacy layout, where each object was stored as one plain JSON value. Rooms
 * created before the schema change still hold legacy values in IndexedDB and on
 * the server, and reading them must not throw.
 */
function fieldReader(value: unknown): (key: string) => unknown {
  if (isYMap(value)) return (key) => value.get(key);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (key) => record[key];
  }
  return () => undefined;
}

function readProps(get: (key: string) => unknown): Record<string, unknown> {
  const raw = get("props");
  if (isYMap(raw)) return raw.toJSON();
  if (raw !== null && typeof raw === "object") {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Materialise a plain CanvasObject so the rest of the app never touches Yjs. */
export function readObject(source: unknown): CanvasObject {
  const get = fieldReader(source);
  const id = get("id");
  const type = get("type");
  return {
    id: typeof id === "string" ? id : "",
    type: (typeof type === "string" ? type : "shape") as CanvasObject["type"],
    x: asNumber(get("x"), 0),
    y: asNumber(get("y"), 0),
    rotation: asNumber(get("rotation"), 0),
    scaleX: asNumber(get("scaleX"), 1),
    scaleY: asNumber(get("scaleY"), 1),
    width: asNumber(get("width"), 0),
    height: asNumber(get("height"), 0),
    zIndex: asNumber(get("zIndex"), 0),
    opacity: asNumber(get("opacity"), 1),
    props: readProps(get),
    physics: (get("physics") as CanvasObject["physics"]) ?? createDefaultPhysics(false),
    vx: asNumber(get("vx"), 0),
    vy: asNumber(get("vy"), 0),
    createdBy: get("createdBy") as string | undefined,
    createdAt: get("createdAt") as number | undefined,
    updatedAt: get("updatedAt") as number | undefined,
  };
}

/**
 * Rewrites any legacy plain-value entries as per-field Y.Maps. Converging on one
 * layout is safe to run from any peer: every client derives the same replacement
 * from the same source value.
 */
export function migrateLegacyObjects(objects: YObjects): number {
  const legacy: CanvasObject[] = [];
  objects.forEach((value, id) => {
    if (isYMap(value)) return;
    const obj = readObject(value);
    legacy.push(obj.id ? obj : { ...obj, id });
  });
  if (legacy.length === 0) return 0;

  const apply = () => {
    for (const obj of legacy) objects.set(obj.id, createYObject(obj));
  };
  const doc = objects.doc;
  if (doc) doc.transact(apply);
  else apply();
  console.info(`[orbitboard] migrated ${legacy.length} legacy object(s) to Y.Map`);
  return legacy.length;
}

export function upsertYObject(objects: YObjects, obj: CanvasObject): void {
  const existing = objects.get(obj.id);
  if (isYMap(existing)) {
    patchYObject(objects, obj.id, obj);
    return;
  }
  // Missing, or a legacy plain value: replace it outright.
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
  // A legacy plain value has no per-field API; migrateLegacyObjects converts
  // those on load, so anything still un-migrated here is simply skipped.
  if (!isYMap(y)) return;
  const doc = objects.doc;
  const apply = () => {
    for (const key of CANVAS_OBJECT_FIELDS) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value === undefined) continue;
      if (y.get(key) !== value) y.set(key, value);
    }
    if (patch.props) {
      const existing = y.get("props");
      const target: YProps = isYMap(existing)
        ? existing
        : (() => {
            const created: YProps = new Y.Map();
            y.set("props", created);
            return created;
          })();
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

type ObjectChangeSet = {
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
