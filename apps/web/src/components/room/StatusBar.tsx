"use client";

import { useRoomState } from "@/components/room/RoomStoreProvider";

export function StatusBar() {
  const identity = useRoomState((s) => s.identity);
  const connected = useRoomState((s) => s.connected);
  const online = useRoomState((s) => s.online);
  const synced = useRoomState((s) => s.synced);
  const isHost = useRoomState((s) => s.isHost);
  const remotes = useRoomState((s) => s.remotes);

  const offline = !online || !connected;

  return (
    <>
      {offline && (
        <div className="absolute left-1/2 top-[4.5rem] z-30 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-900 backdrop-blur-md dark:text-amber-100">
          {!online
            ? "You are offline — edits are saved locally and will sync when back online."
            : "Reconnecting to collaboration server… local changes are preserved."}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-col gap-2">
        <div className="ui-panel pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-[var(--foreground)]">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: identity.color }}
          />
          <span className="font-medium">{identity.username}</span>
          <span className="ui-muted">·</span>
          <span className={connected && online ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"}>
            {connected && online ? "Live" : "Offline"}
          </span>
          {synced && <span className="ui-muted">· synced</span>}
          {isHost && <span className="text-sky-700 dark:text-sky-400">· physics host</span>}
        </div>
        <div className="pointer-events-auto flex -space-x-2">
          {remotes.slice(0, 6).map((r) => (
            <div
              key={r.userId}
              title={r.username}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--canvas-bg)] text-[10px] font-bold text-white"
              style={{ background: r.color }}
            >
              {r.username.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
