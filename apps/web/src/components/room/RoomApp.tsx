"use client";

import { useEffect, useState } from "react";
import type { Tool } from "@infinite-canvas/shared";
import {
  RoomStoreProvider,
  useRoomActions,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { Minimap } from "@/components/minimap/Minimap";
import { ReplayPanel } from "@/components/replay/ReplayPanel";
import { StatusBar } from "@/components/room/StatusBar";
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        actions.selectAll();
        return;
      }

      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool && !e.metaKey && !e.ctrlKey) actions.setTool(tool);
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  const allSelected = selectedCount > 1 && selectedCount === objectCount;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[var(--canvas-bg)]">
      <CanvasStage />
      <Toolbar
        onOpenReplay={() => setReplayOpen(true)}
        onOpenTour={() => {
          resetOnboarding();
          setTourOpen(true);
        }}
      />
      {!replayOpen && <Minimap />}
      <StatusBar />
      {allSelected && (
        <div className="pointer-events-none absolute left-1/2 top-[4.75rem] z-20 -translate-x-1/2 rounded-full bg-[var(--accent)]/90 px-3 py-1 text-xs font-semibold text-[#06201d]">
          All {objectCount} objects selected — drag to move · handles to resize · Delete
          to remove
        </div>
      )}
      {replayOpen && (
        <div className="pointer-events-none absolute left-3 top-20 z-20 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-[#1a1508]">
          Replay mode — canvas shows history
        </div>
      )}
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
