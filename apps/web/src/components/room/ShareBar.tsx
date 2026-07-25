"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomState } from "@/components/room/RoomStoreProvider";
import { ShareIcon } from "@/components/ui/icons";

const MESSAGE_MS = 2200;

/**
 * Top-right presence and invite, mirroring where collaborative canvases put
 * their share affordance. The connection state rides along as a dot on the
 * user's own avatar rather than a separate status widget.
 */
export function ShareBar() {
  const identity = useRoomState((s) => s.identity);
  const remotes = useRoomState((s) => s.remotes);
  const connected = useRoomState((s) => s.connected);
  const online = useRoomState((s) => s.online);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function flash(text: string) {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), MESSAGE_MS);
  }

  async function copyInvite() {
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      flash("Invite link copied");
    } catch {
      window.prompt("Copy this invite link:", url);
      flash("Copy the link from the dialog");
    }
  }

  const live = connected && online;

  return (
    <div className="pointer-events-none flex flex-col items-end gap-2">
      <div className="ui-card pointer-events-auto flex items-center gap-2 p-1 pl-2">
        <div className="flex -space-x-1.5">
          <span
            title={`${identity.username} (you) — ${live ? "connected" : "offline"}`}
            className="relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[var(--ui-bg)]"
            style={{ background: identity.color }}
          >
            {identity.username.slice(0, 2).toUpperCase()}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ui-bg)] ${
                live ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          {remotes.slice(0, 3).map((r) => (
            <span
              key={r.userId}
              title={r.username}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[var(--ui-bg)]"
              style={{ background: r.color }}
            >
              {r.username.slice(0, 2).toUpperCase()}
            </span>
          ))}
          {remotes.length > 3 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ui-active)] text-[10px] font-bold ring-2 ring-[var(--ui-bg)]">
              +{remotes.length - 3}
            </span>
          )}
        </div>

        <button
          type="button"
          className="ui-icon-btn w-auto gap-2 px-3 text-[13px] font-semibold"
          style={{ background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }}
          onClick={() => void copyInvite()}
        >
          <ShareIcon />
          Share
        </button>
      </div>

      {message && (
        <div className="ui-card px-3 py-1.5 text-[12px] font-medium">{message}</div>
      )}

      {!live && (
        <div className="ui-card max-w-[15rem] px-3 py-1.5 text-[12px] leading-snug">
          {!online
            ? "Offline — edits are saved locally and sync when you reconnect."
            : "Reconnecting… local changes are preserved."}
        </div>
      )}
    </div>
  );
}
