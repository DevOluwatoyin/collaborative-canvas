import { resolveCollabUrl } from "@/lib/yjs/provider";
import { getMediaBlob } from "./store";

/** The collab server speaks both ws:// and http:// on the same host and port. */
export function mediaHttpBase(): string {
  try {
    const url = new URL(resolveCollabUrl());
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:1234";
  }
}

export function isInlineSrc(src: string): boolean {
  return src.startsWith("data:") || src.startsWith("blob:");
}

export type UploadedMedia = { id: string; url: string };

/**
 * Uploads bytes to the collab server and returns an absolute URL, or null when
 * the server is unreachable (offline, or media endpoint not deployed). Callers
 * fall back to an inline data URL in that case so creating media offline still
 * works — it just costs document size until re-created online.
 */
export async function uploadMedia(blob: Blob): Promise<UploadedMedia | null> {
  const base = mediaHttpBase();
  try {
    const response = await fetch(`${base}/media`, {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
    if (!response.ok) {
      console.warn("[orbitboard] media upload rejected:", response.status);
      return null;
    }
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as UploadedMedia).id === "string" &&
      typeof (data as UploadedMedia).url === "string"
    ) {
      const { id, url } = data as UploadedMedia;
      return { id, url: url.startsWith("http") ? url : `${base}${url}` };
    }
    return null;
  } catch (err) {
    console.warn("[orbitboard] media upload failed, inlining instead:", err);
    return null;
  }
}

const localUrlCache = new Map<string, string>();

/**
 * Object URL for the locally cached copy of an object's media. Used when the
 * remote URL cannot be fetched (server down, or the peer that uploaded it is
 * offline) so the creator keeps seeing their own image.
 */
export async function localMediaUrl(objectId: string): Promise<string | null> {
  const cached = localUrlCache.get(objectId);
  if (cached) return cached;
  const blob = await getMediaBlob(objectId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  localUrlCache.set(objectId, url);
  return url;
}

export function releaseLocalMediaUrls(): void {
  for (const url of localUrlCache.values()) URL.revokeObjectURL(url);
  localUrlCache.clear();
}
