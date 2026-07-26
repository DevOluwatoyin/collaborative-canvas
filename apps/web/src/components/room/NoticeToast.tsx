"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useRoomActions, useRoomState } from "./RoomStoreProvider";

const DISMISS_MS = 7000;

/**
 * Transient message for things the user needs to act on — a rejected upload, a
 * failed paste. Errors stay long enough to read a sentence of remedy, and can be
 * dismissed early.
 */
export function NoticeToast() {
  const notice = useRoomState((s) => s.notice);
  const actions = useRoomActions();
  const id = notice?.id;

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => actions.dismissNotice(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, actions]);

  if (!notice) return null;

  const isError = notice.tone === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-20 z-40 flex justify-center px-3"
    >
      <div
        className="ui-card pointer-events-auto flex max-w-md items-start gap-2 px-3 py-2.5 text-[13px] leading-snug"
        style={
          isError
            ? { borderColor: "rgba(220,38,38,.45)", boxShadow: "0 1px 14px rgba(220,38,38,.18)" }
            : undefined
        }
      >
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            isError ? "bg-red-500" : "bg-[var(--ui-selected)]"
          }`}
        />
        <span className="flex-1">{notice.message}</span>
        <button
          type="button"
          className="ui-icon-btn -mr-1 -mt-1 h-7 w-7 shrink-0"
          title="Dismiss"
          aria-label="Dismiss message"
          onClick={actions.dismissNotice}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
