"use client";

import { useEffect, useState } from "react";
import type { Tool } from "@infinite-canvas/shared";
import {
  RoomStoreProvider,
  useRoomActions,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { ToolStrip } from "@/components/toolbar/ToolStrip";
import { ActionsBar } from "@/components/toolbar/ActionsBar";
import { ZoomControl } from "@/components/toolbar/ZoomControl";
import { StylePanel } from "@/components/style/StylePanel";
import { MainMenu } from "@/components/menu/MainMenu";
import { ShareBar } from "@/components/room/ShareBar";
import { Minimap } from "@/components/minimap/Minimap";
import { ReplayPanel } from "@/components/replay/ReplayPanel";
import {
  OnboardingWizard,
  resetOnboarding,
  shouldShowOnboarding,
} from "@/components/onboarding/OnboardingWizard";

const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: "select",
  h: "pan",
  d: "draw",
  t: "text",
  s: "shape",
  n: "sticky",
  i: "image",
  a: "audio",
  p: "physics",
};

function RoomInner() {
  const [replayOpen, setReplayOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [radarVisible, setRadarVisible] = useState(true);
  const actions = useRoomActions();
  const selectedCount = useRoomState((s) => s.selectedIds.length);
  const objectCount = useRoomState((s) => s.objectCount);

  useEffect(() => {
    if (!shouldShowOnboarding()) return;
    const timer = setTimeout(() => setTourOpen(true), 400);
    return () => clearTimeout(timer);
  }, []);

  // Actions are stable for the room's lifetime, so this listener is attached
  // once instead of being re-bound on every selection change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        actions.redo();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        actions.selectAll();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        actions.duplicateSelected();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.removeSelected();
        return;
      }

      const tool = TOOL_SHORTCUTS[key];
      if (tool && !mod) actions.setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  const allSelected = selectedCount > 1 && selectedCount === objectCount;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[var(--canvas-bg)]">
      <CanvasStage />

      {/* Chrome floats over the canvas; each cluster owns one corner or edge and
          is pointer-transparent between panels so the canvas stays reachable. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-3 top-3 flex items-start gap-2">
          <MainMenu
            onOpenReplay={() => setReplayOpen(true)}
            onOpenTour={() => {
              resetOnboarding();
              setTourOpen(true);
            }}
            radarVisible={radarVisible}
            onToggleRadar={() => setRadarVisible((v) => !v)}
          />
        </div>

        <div className="absolute z-10 right-3 top-3">
          <ShareBar />
        </div>

        {!replayOpen && (
          <div className="absolute right-3 top-[4.75rem] hidden md:block">
            <StylePanel />
          </div>
        )}

        {allSelected && (
          <div className="ui-card absolute left-1/2 top-3 -translate-x-1/2 px-3 py-1.5 text-[12px] font-medium">
            All {objectCount.toLocaleString()} objects selected
          </div>
        )}

        {replayOpen && (
          <div className="ui-card absolute left-1/2 top-3 -translate-x-1/2 px-3 py-1.5 text-[12px] font-semibold text-amber-600 dark:text-amber-300">
            Replay mode — canvas shows history
          </div>
        )}

        {/* Narrow viewports stack the zoom pill above the centred toolbars,
            which grow wide enough to reach the left edge. */}
        <div className="absolute bottom-[7.5rem] left-3 sm:bottom-3">
          <ZoomControl />
        </div>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <ActionsBar />
          <ToolStrip />
        </div>

        {radarVisible && !replayOpen && <Minimap />}
      </div>

      {replayOpen && <ReplayPanel onClose={() => setReplayOpen(false)} />}
      {tourOpen && <OnboardingWizard onClose={() => setTourOpen(false)} />}
    </div>
  );
}

export function RoomApp({ roomId }: { roomId: string }) {
  return (
    <RoomStoreProvider roomId={roomId}>
      <RoomInner />
    </RoomStoreProvider>
  );
}
