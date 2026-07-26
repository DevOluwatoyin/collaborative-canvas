/**
 * Every write the room performs on the CRDT, grouped by what it does:
 *
 *   core     transaction primitives shared by the rest
 *   create   placing new objects and freehand strokes
 *   media    image and audio objects, including the upload policy
 *   arrange  clipboard, duplication and paint order
 *   physics  impulses applied to a body
 *   history  compensating op-log entries for undo/redo
 *   bulk     the load generator used for performance testing
 */
export type { Actor, MediaResult, ObjectStyle } from "./core";
export { deleteRoomObject, updateRoomObject } from "./core";
export { createObjectAt, createPathFromStroke } from "./create";
export { createAudioObject, createImageObject } from "./media";
export { duplicateRoomObjects, pasteRoomObjects, reorderRoomObjects } from "./arrange";
export { flingRoomObject } from "./physics";
export { recordUndoDiff } from "./history";
export { spawnBulkObjects } from "./bulk";
