"use client";

import { useEffect, useRef, useState } from "react";
import {
  useRoomActions,
  useRoomHandles,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { allObjects, selectedObjects } from "@/components/room/store";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { exportJSON, exportPNG, exportSVG } from "@/lib/export";
import { chromeBtn, TOOLS } from "./constants";
import { SelectionInspector } from "./SelectionInspector";
import { ToolContextPanels } from "./ToolContextPanels";

const BULK_SPAWN_COUNT = 2000;
const INVITE_MESSAGE_MS = 2500;

export function Toolbar({
  onOpenReplay,
  onOpenTour,
}: {
  onOpenReplay: () => void;
  onOpenTour?: () => void;
}) {
  const tool = useRoomState((s) => s.tool);
  const roomId = useRoomState((s) => s.roomId);
  const selectedCount = useRoomState((s) => s.selectedIds.length);
  const actions = useRoomActions();
  const { store, refs } = useRoomHandles();
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (inviteTimer.current) clearTimeout(inviteTimer.current);
    },
    []
  );

  /**
   * Export reads objects on demand rather than subscribing to them: the toolbar
   * has no reason to re-render when a shape moves.
   */
  function exportTarget() {
    const ids = store.getState().selectedIds;
    const selected = selectedObjects(refs, ids);
    return selected.length > 0 ? selected : allObjects(refs);
  }

  function flashInvite(message: string) {
    setInviteMsg(message);
    if (inviteTimer.current) clearTimeout(inviteTimer.current);
    inviteTimer.current = setTimeout(() => setInviteMsg(null), INVITE_MESSAGE_MS);
  }

  async function copyInvite() {
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      flashInvite("Invite link copied!");
    } catch {
      window.prompt("Copy this invite link:", url);
      flashInvite("Copy the link from the dialog");
    }
  }

  const exportLabel = selectedCount > 0 ? `Selected (${selectedCount})` : "All";
  const exportSuffix = selectedCount > 0 ? "*" : "";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 p-3 md:p-4">
      <div className="ui-panel pointer-events-auto mx-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl px-2 py-2 md:gap-2 md:px-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={`${t.label} (${t.hint})`}
            onClick={() => actions.setTool(t.id)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition md:px-3 md:text-sm ${
              tool === t.id
                ? "bg-[var(--accent)] text-[#06201d]"
                : "text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
        <button type="button" className={chromeBtn} onClick={() => void copyInvite()}>
          Invite
        </button>
        <button
          type="button"
          className={chromeBtn}
          title={`Export ${exportLabel} as JSON`}
          onClick={() =>
            exportJSON(
              exportTarget(),
              Object.fromEntries(refs.bindings?.meta.entries() ?? []),
              roomId
            )
          }
        >
          JSON{exportSuffix}
        </button>
        <button
          type="button"
          className={chromeBtn}
          title={`Export ${exportLabel} as SVG`}
          onClick={() => exportSVG(exportTarget(), roomId)}
        >
          SVG{exportSuffix}
        </button>
        <button
          type="button"
          className={chromeBtn}
          title={`Export ${exportLabel} as PNG`}
          onClick={() => void exportPNG(exportTarget(), roomId)}
        >
          PNG{exportSuffix}
        </button>
        <button
          type="button"
          className={chromeBtn}
          onClick={actions.selectAll}
          title="Select all (Ctrl/Cmd+A)"
        >
          Select all
        </button>
        <button type="button" className={chromeBtn} onClick={onOpenReplay}>
          Time Travel
        </button>
        {onOpenTour && (
          <button type="button" className={chromeBtn} onClick={onOpenTour}>
            Help
          </button>
        )}
        <button
          type="button"
          className={chromeBtn}
          title="Load generator for performance testing"
          onClick={() => actions.spawnBulk(BULK_SPAWN_COUNT)}
        >
          Spawn {BULK_SPAWN_COUNT}
        </button>
        <ThemeToggle />
      </div>

      {inviteMsg && (
        <div className="pointer-events-none mx-auto rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[#06201d]">
          {inviteMsg}
        </div>
      )}

      <ToolContextPanels />
      <SelectionInspector />
    </div>
  );
}
