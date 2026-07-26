"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomState } from "@/components/room/RoomStoreProvider";
import { ShareIcon } from "@/components/ui/icons";

const MESSAGE_MS = 2200;

/** Collaborators shown individually before collapsing into a +N chip. */
const MAX_AVATARS = 3;

/** Slightly smaller on phones, where the header competes for width. */
const AVATAR_SIZE = "h-6 w-6 text-[9px] sm:h-7 sm:w-7 sm:text-[10px]";

/** "Ada Lovelace" -> "AL"; a single name falls back to its first two letters. */
function initials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

/**
 * Top-right presence and invite. Connection state rides along as a dot on the
 * user's own avatar rather than occupying a separate status widget.
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
      <div data-tour="share" className="ui-card pointer-events-auto flex items-center gap-2 p-1 pl-2">
        {/* Overlapping stack, capped at MAX_AVATARS with a +N chip. The list is
            unbounded, so without a cap a busy room pushes Share off-screen. */}
        <div className="flex -space-x-2">
          <span
            title={`${identity.username} (you) — ${live ? "connected" : "offline"}`}
            className={`relative flex items-center justify-center rounded-full font-bold text-white ring-2 ring-[var(--ui-bg)] ${AVATAR_SIZE}`}
            style={{ background: identity.color }}
          >
            {initials(identity.username)}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ui-bg)] ${
                live ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          {remotes.slice(0, MAX_AVATARS).map((r) => (
            <span
              key={r.clientId ?? r.userId}
              title={r.username}
              className={`flex items-center justify-center rounded-full font-bold text-white ring-2 ring-[var(--ui-bg)] ${AVATAR_SIZE}`}
              style={{ background: r.color }}
            >
              {initials(r.username)}
            </span>
          ))}
          {remotes.length > MAX_AVATARS && (
            <span
              title={remotes
                .slice(MAX_AVATARS)
                .map((r) => r.username)
                .join(", ")}
              className={`flex items-center justify-center rounded-full bg-[var(--ui-active)] font-bold ring-2 ring-[var(--ui-bg)] ${AVATAR_SIZE}`}
            >
              +{remotes.length - MAX_AVATARS}
            </span>
          )}
        </div>

        <button
          type="button"
          className="ui-icon-btn w-auto group gap-2 px-3 text-[13px] font-semibold relative"
          style={{ background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }}
          onClick={() => void copyInvite()}
        >
          <ShareIcon />

          <span className="absolute hidden bg-black text-white -bottom-8 transition p-1 text-xs rounded-lg group-hover:block">
            Share
          </span>
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
