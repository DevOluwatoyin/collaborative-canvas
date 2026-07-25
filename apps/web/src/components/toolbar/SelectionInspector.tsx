"use client";

import { useState } from "react";
import { propString } from "@infinite-canvas/shared";
import {
  useObject,
  useRoomActions,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { localMediaUrl } from "@/lib/media/remote";
import { chromeBtn } from "./constants";

export function SelectionInspector() {
  const selectedIds = useRoomState((s) => s.selectedIds);
  const actions = useRoomActions();
  const selected = useObject(selectedIds[0] ?? null);
  const [audioFallback, setAudioFallback] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const isTextual =
    selected &&
    (selected.type === "text" || selected.type === "sticky" || selected.type === "shape");
  const audioSrc =
    selected?.type === "audio" ? audioFallback ?? propString(selected.props, "src") : "";

  return (
    <div className="ui-panel pointer-events-auto mx-auto flex max-w-lg flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-[var(--foreground)]">
      <span className="font-medium">
        {selectedIds.length > 1 ? `${selectedIds.length} selected` : selected?.type}
      </span>
      {selected && isTextual && selectedIds.length === 1 && (
        <>
          <input
            className="ui-input min-w-[10rem] flex-1 rounded-lg px-2 py-1 text-sm"
            value={propString(selected.props, "text")}
            placeholder={selected.type === "shape" ? "Shape label…" : "Text…"}
            onChange={(e) =>
              actions.updateObject(selected.id, { props: { text: e.target.value } })
            }
          />
          <button
            type="button"
            className={chromeBtn}
            onClick={() => actions.setEditingTextId(selected.id)}
          >
            Edit
          </button>
        </>
      )}
      {selected?.type === "audio" && audioSrc && (
        <audio
          controls
          src={audioSrc}
          className="h-8 max-w-[12rem]"
          // Falls back to the locally cached blob if the media server is down.
          onError={() => {
            void localMediaUrl(selected.id).then((url) => {
              if (url) setAudioFallback(url);
            });
          }}
        />
      )}
      <span className="ui-muted hidden sm:inline">Shift+click · drag box</span>
      <button
        type="button"
        className="rounded-lg bg-red-500/15 px-2 py-1 text-red-600 hover:bg-red-500/25 dark:text-red-300"
        onClick={actions.removeSelected}
      >
        Delete
      </button>
    </div>
  );
}
