import type http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/**
 * Media (images, audio) is stored here and referenced from the CRDT document by
 * URL. Embedding the bytes as base64 data URLs inside the Yjs doc — as this used
 * to do — means every image is replicated to every peer through the sync
 * protocol, kept in every client's IndexedDB, and re-broadcast on every
 * reconnect. Blobs bypass the document entirely; only the URL is collaborative.
 */
export const MEDIA_DIR =
  process.env.MEDIA_DIR || path.join(os.tmpdir(), "orbitboard-media");

export const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 8 * 1024 * 1024);

/**
 * SVG is deliberately absent: it can carry script and would be served from this
 * origin, so allowing it would turn the media store into an XSS vector.
 */
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{8,48}$/;

function ensureDir(): void {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function blobPath(id: string): string {
  return path.join(MEDIA_DIR, `${id}.blob`);
}

function typePath(id: string): string {
  return path.join(MEDIA_DIR, `${id}.type`);
}

function setCors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleUpload(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const contentType = (req.headers["content-type"] || "").split(";")[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    sendJson(res, 415, { error: `unsupported media type: ${contentType || "none"}` });
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req, MAX_MEDIA_BYTES);
  } catch {
    sendJson(res, 413, { error: "payload too large", maxBytes: MAX_MEDIA_BYTES });
    return;
  }
  if (body.length === 0) {
    sendJson(res, 400, { error: "empty body" });
    return;
  }

  ensureDir();
  const id = crypto.randomBytes(16).toString("base64url");
  await fs.promises.writeFile(blobPath(id), body);
  await fs.promises.writeFile(typePath(id), contentType, "utf8");
  sendJson(res, 201, { id, url: `/media/${id}`, bytes: body.length });
}

async function handleDownload(
  id: string,
  res: http.ServerResponse
): Promise<void> {
  if (!ID_PATTERN.test(id)) {
    sendJson(res, 400, { error: "bad media id" });
    return;
  }
  try {
    const [blob, type] = await Promise.all([
      fs.promises.readFile(blobPath(id)),
      fs.promises.readFile(typePath(id), "utf8").catch(() => "application/octet-stream"),
    ]);
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": blob.length,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.end(blob);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

/** Returns true when the request was a media route and has been handled. */
export function handleMediaRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const url = new URL(req.url || "/", `http://${req.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/media")) return false;

  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === "POST" && url.pathname === "/media") {
    void handleUpload(req, res).catch((err: unknown) => {
      console.error("media upload failed:", err);
      if (!res.headersSent) sendJson(res, 500, { error: "upload failed" });
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/media/")) {
    const id = decodeURIComponent(url.pathname.slice("/media/".length));
    void handleDownload(id, res).catch((err: unknown) => {
      console.error("media download failed:", err);
      if (!res.headersSent) sendJson(res, 500, { error: "download failed" });
    });
    return true;
  }

  sendJson(res, 405, { error: "method not allowed" });
  return true;
}
