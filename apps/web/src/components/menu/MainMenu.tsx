"use client";

import { useRoomActions, useRoomHandles, useRoomState } from "@/components/room/RoomStoreProvider";
import { allObjects, selectedObjects } from "@/components/room/store";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { exportJSON, exportPNG, exportSVG } from "@/lib/export";
import { Popover } from "@/components/ui/Popover";
import {
  DownloadIcon,
  HelpIcon,
  HistoryIcon,
  MenuIcon,
  MoonIcon,
  RadarIcon,
  SpawnIcon,
  SunIcon,
} from "@/components/ui/icons";

const BULK_SPAWN_COUNT = 2000;

/**
 * Top-left brand and menu. Everything that is not a canvas tool lives here —
 * exports, session replay, the tour and display toggles — so the canvas edges
 * stay clear.
 */
export function MainMenu({
  onOpenReplay,
  onOpenTour,
  radarVisible,
  onToggleRadar,
}: {
  onOpenReplay: () => void;
  onOpenTour: () => void;
  radarVisible: boolean;
  onToggleRadar: () => void;
}) {
  const roomId = useRoomState((s) => s.roomId);
  const selectedCount = useRoomState((s) => s.selectedIds.length);
  const actions = useRoomActions();
  const { store, refs } = useRoomHandles();
  const { theme, toggleTheme } = useTheme();

  /** Exports read objects on demand so the menu never re-renders on canvas edits. */
  function exportTarget() {
    const selected = selectedObjects(refs, store.getState().selectedIds);
    return selected.length > 0 ? selected : allObjects(refs);
  }

  const scope = selectedCount > 0 ? `selection (${selectedCount})` : "whole canvas";

  return (
    <div className="ui-card pointer-events-auto flex items-center gap-1 p-1 pl-2.5">
      <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight">
        Orbitboard
      </span>

      <Popover label="Menu" icon={<MenuIcon />} placement="bottom-start" panelClassName="w-[228px]">
        {(close) => (
          <div>
            <p className="ui-label px-2 pb-1 pt-1">Export {scope}</p>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                exportPNG(exportTarget(), roomId).catch(() => undefined);
                close();
              }}
            >
              <DownloadIcon />
              Export PNG
            </button>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                exportSVG(exportTarget(), roomId);
                close();
              }}
            >
              <DownloadIcon />
              Export SVG
            </button>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                exportJSON(
                  exportTarget(),
                  Object.fromEntries(refs.bindings?.meta.entries() ?? []),
                  roomId
                );
                close();
              }}
            >
              <DownloadIcon />
              Export JSON
            </button>

            <div className="ui-divider" />

            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                onOpenReplay();
                close();
              }}
            >
              <HistoryIcon />
              Time travel
            </button>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                onToggleRadar();
                close();
              }}
            >
              <RadarIcon />
              {radarVisible ? "Hide radar" : "Show radar"}
            </button>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                toggleTheme();
                close();
              }}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Light panels" : "Dark panels"}
            </button>

            <div className="ui-divider" />

            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                actions.spawnBulk(BULK_SPAWN_COUNT);
                close();
              }}
            >
              <SpawnIcon />
              Spawn {BULK_SPAWN_COUNT.toLocaleString()} shapes
            </button>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                onOpenTour();
                close();
              }}
            >
              <HelpIcon />
              Take the tour
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
}
