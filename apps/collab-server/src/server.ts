import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { handleMediaRequest, MAX_MEDIA_BYTES, MEDIA_DIR } from "./media.js";

const PORT = Number(process.env.PORT || 1234);
const ROOM_GRACE_MS = 60_000;
const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

type Room = {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  controlledIds: Map<WebSocket, Set<number>>;
  reaper?: NodeJS.Timeout;
};

const rooms = new Map<string, Room>();

function broadcast(room: Room, message: Uint8Array, except?: WebSocket): void {
  for (const client of room.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getRoom(roomName: string): Room {
  const existing = rooms.get(roomName);
  if (existing) {
    if (existing.reaper) {
      clearTimeout(existing.reaper);
      existing.reaper = undefined;
    }
    return existing;
  }

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const room: Room = {
    doc,
    awareness,
    clients: new Set(),
    controlledIds: new Map(),
  };
  rooms.set(roomName, room);

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(
      room,
      encoding.toUint8Array(encoder),
      origin instanceof WebSocket ? origin : undefined
    );
  });

  awareness.on(
    "update",
    (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin instanceof WebSocket) {
        let owned = room.controlledIds.get(origin);
        if (!owned) {
          owned = new Set();
          room.controlledIds.set(origin, owned);
        }
        for (const id of added) owned.add(id);
        for (const id of removed) owned.delete(id);
      }

      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
      );
      broadcast(room, encoding.toUint8Array(encoder));
    }
  );

  return room;
}

function send(conn: WebSocket, message: Uint8Array): void {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message);
  }
}

const server = http.createServer((req, res) => {
  if (handleMediaRequest(req, res)) return;
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Orbitboard collab server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host ?? "localhost"}`);
  const roomName = decodeURIComponent(url.pathname.replace(/^\//, "") || "default");
  const room = getRoom(roomName);
  room.clients.add(conn);
  room.controlledIds.set(conn, new Set());

  conn.binaryType = "arraybuffer";

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    send(conn, encoding.toUint8Array(encoder));

    const awarenessStates = room.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder2 = encoding.createEncoder();
      encoding.writeVarUint(encoder2, messageAwareness);
      encoding.writeVarUint8Array(
        encoder2,
        awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      send(conn, encoding.toUint8Array(encoder2));
    }
  }

  conn.on("message", (data: ArrayBuffer | Buffer) => {
    try {
      const uint8 = new Uint8Array(data as ArrayBuffer);
      const decoder = decoding.createDecoder(uint8);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);
          if (encoding.length(encoder) > 1) {
            send(conn, encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            conn
          );
          break;
        }
        case messageQueryAwareness: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              room.awareness,
              Array.from(room.awareness.getStates().keys())
            )
          );
          send(conn, encoding.toUint8Array(encoder));
          break;
        }
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  conn.on("close", () => {
    room.clients.delete(conn);
    const owned = room.controlledIds.get(conn);
    room.controlledIds.delete(conn);
    if (owned && owned.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(owned),
        null
      );
    }

    if (room.clients.size === 0 && !room.reaper) {
      room.reaper = setTimeout(() => {
        if (room.clients.size > 0) return;
        room.doc.destroy();
        room.awareness.destroy();
        rooms.delete(roomName);
      }, ROOM_GRACE_MS);
    }
  });
});

server.listen(PORT, () => {
  console.info(`Collab server listening on ws://localhost:${PORT}`);
  console.info(
    `Media store: ${MEDIA_DIR} (max ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB per upload)`
  );
});
