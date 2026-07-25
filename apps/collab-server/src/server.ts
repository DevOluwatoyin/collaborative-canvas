import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const PORT = Number(process.env.PORT || 1234);
const messageSync = 0;
const messageAwareness = 1;

type Room = {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
};

const rooms = new Map<string, Room>();

function getRoom(roomName: string): Room {
  let room = rooms.get(roomName);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, clients: new Set() };
    rooms.set(roomName, room);

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      for (const client of room!.clients) {
        if (client !== origin && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });

    awareness.on(
      "update",
      ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changed = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
        );
        const message = encoding.toUint8Array(encoder);
        for (const client of room!.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        }
      }
    );
  }
  return room;
}

function send(conn: WebSocket, message: Uint8Array) {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message);
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Infinite Canvas collab server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const roomName = decodeURIComponent(url.pathname.replace(/^\//, "") || "default");
  const room = getRoom(roomName);
  room.clients.add(conn);

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
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  conn.on("close", () => {
    room.clients.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(room.awareness.getStates().keys()).filter((clientId) => {
        const state = room.awareness.getStates().get(clientId);
        return state && (state as { conn?: WebSocket }).conn === conn;
      }),
      null
    );

    // Clean awareness for this connection by scanning controlled ids is tricky;
    // clients clear their own awareness on unload. If room empty, keep doc warm briefly.
    if (room.clients.size === 0) {
      setTimeout(() => {
        if (room.clients.size === 0) {
          room.doc.destroy();
          room.awareness.destroy();
          rooms.delete(roomName);
        }
      }, 60_000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Collab server listening on ws://localhost:${PORT}`);
});
