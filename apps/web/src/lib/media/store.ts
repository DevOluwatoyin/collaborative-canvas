const DB_NAME = "infinite-canvas-media";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("[orbitboard] Media IndexedDB unavailable:", req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (err) {
      console.warn("[orbitboard] Media IndexedDB blocked:", err);
      resolve(null);
    }
  });
}

export async function putMediaBlob(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Best-effort local cache. The authoritative copy lives on the collab
    // server; this only backs the offline fallback in lib/media/remote.ts.
  }
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  try {
    const db = await openDb();
    if (!db) return undefined;
    return await new Promise<Blob | undefined>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result as Blob | undefined);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader did not return a data URL"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed to read blob"));
    reader.readAsDataURL(blob);
  });
}
