import {
  createCanvasObject,
  formatBytes,
  MEDIA_MAX_INLINE_BYTES,
  type PathPoint,
} from "@infinite-canvas/shared";
import type { RoomBindings } from "@/lib/yjs/provider";
import { blobToDataUrl, putMediaBlob } from "@/lib/media/store";
import { uploadMedia } from "@/lib/media/remote";
import {
  createRoomObject,
  newObjectId,
  nextZIndex,
  type Actor,
  type MediaResult,
} from "./core";

/**
 * Uploads media and returns props referencing it by URL.
 *
 * When the server is unreachable the bytes are inlined as a data URL so creating
 * media offline still works, but only up to MEDIA_MAX_INLINE_BYTES: inlined bytes
 * live in the CRDT, so a large file would be replicated to every peer and
 * persisted in every browser. Past that the caller is told to retry online rather
 * than the document silently absorbing it.
 */
async function mediaProps(
  objectId: string,
  blob: Blob,
  extra: Record<string, unknown>
): Promise<MediaResult<{ props: Record<string, unknown> }>> {
  await putMediaBlob(objectId, blob);
  const uploaded = await uploadMedia(blob);
  if (uploaded) {
    return { ok: true, props: { ...extra, src: uploaded.url, mediaId: uploaded.id } };
  }

  if (blob.size > MEDIA_MAX_INLINE_BYTES) {
    return {
      ok: false,
      message: `The media server is unreachable, and ${formatBytes(blob.size)} is too large to store in the board itself (limit ${formatBytes(
        MEDIA_MAX_INLINE_BYTES
      )}). Reconnect and try again, or use a smaller file.`,
    };
  }

  return {
    ok: true,
    props: { ...extra, src: await blobToDataUrl(blob), inlineMedia: true },
  };
}

/**
 * Creates an image object from an already-picked file. Separate from
 * createObjectAt because the toolbar opens the picker directly, without the
 * placement click that path assumes.
 */
export async function createImageObject(
  bindings: RoomBindings,
  actor: Actor,
  world: PathPoint,
  file: File
): Promise<MediaResult<{ id: string }>> {
  const id = newObjectId();
  const media = await mediaProps(id, file, { name: file.name });
  if (!media.ok) return media;
  const props = media.props;
  // Fit the natural aspect ratio into a sensible default box so portraits are
  // not stretched into the old fixed 240x180 frame.
  const { width, height } = await fitImageBox(file);
  const obj = createCanvasObject({
    id,
    type: "image",
    x: world.x - width / 2,
    y: world.y - height / 2,
    width,
    height,
    zIndex: nextZIndex(),
    createdBy: actor.id,
    props,
  });
  createRoomObject(bindings, actor, obj);
  return { ok: true, id };
}

const IMAGE_MAX_EDGE = 320;

async function fitImageBox(file: Blob): Promise<{ width: number; height: number }> {
  const fallback = { width: 240, height: 180 };
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return fallback;
    const scale = Math.min(IMAGE_MAX_EDGE / w, IMAGE_MAX_EDGE / h, 1);
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  } catch {
    return fallback;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Creates the audio object once the recorder panel has captured a clip. */
export async function createAudioObject(
  bindings: RoomBindings,
  actor: Actor,
  world: PathPoint,
  blob: Blob,
  durationMs: number
): Promise<MediaResult<{ id: string }>> {
  const id = newObjectId();
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const media = await mediaProps(id, blob, {
    label: `${seconds}s clip`,
    durationMs,
  });
  if (!media.ok) return media;
  const props = media.props;
  const width = 200;
  const height = 72;
  const obj = createCanvasObject({
    id,
    type: "audio",
    x: world.x - width / 2,
    y: world.y - height / 2,
    width,
    height,
    zIndex: nextZIndex(),
    createdBy: actor.id,
    props,
  });
  createRoomObject(bindings, actor, obj);
  return { ok: true, id };
}
