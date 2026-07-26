"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasEngine } from "@/components/canvas/CanvasEngine";
import { TextEditorOverlay } from "@/components/canvas/TextEditorOverlay";
import {
  useObject,
  useRoomActions,
  useRoomHandles,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { setViewportCenterHandle, setZoomHandle } from "@/components/room/store";
import { getCurrentTheme, useTheme } from "@/lib/theme/ThemeProvider";

/**
 * Owns the Pixi renderer. Nothing here re-renders React on canvas activity: the
 * engine reads the room's mutable object map, and a single requestAnimationFrame
 * loop drains the pending change queue and repaints. React is involved only for
 * mount/unmount and the text-edit overlay.
 */
export function CanvasStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  // The engine is kept in state, not a ref, because the text-edit overlay reads
  // it during render and reading a ref during render is not safe.
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const { store, refs } = useRoomHandles();
  const actions = useRoomActions();
  const editingTextId = useRoomState((s) => s.editingTextId);
  const editingObj = useObject(editingTextId);
  const { theme } = useTheme();

  // Palette changes are pushed into the existing renderer rather than being an
  // effect dependency, so switching theme never rebuilds the WebGL context.
  useEffect(() => {
    engine?.setTheme(theme);
  }, [engine, theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const instance = new CanvasEngine({
      onViewportChange: (vp) => {
        if (!instance.isReady) return;
        // Zustand compares the selected slice, so panning (which does not change
        // zoom) writes the same number and re-renders nothing.
        store.setState({ zoom: vp.zoom });
        const bounds = instance.getWorldBounds();
        actions.updatePresence({
          viewport: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            zoom: vp.zoom,
          },
          viewportCenter: {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          },
        });
      },
      onCursorMove: (cursor) => actions.updatePresence({ cursor }),
      onSelect: (ids, additive) => {
        // Shift-dragging a marquee adds to the selection rather than replacing
        // it; the previous callback dropped the additive flag on the floor.
        if (additive) actions.addToSelection(ids);
        else actions.setSelectedIds(ids);
      },
      onObjectMove: (updates) => {
        for (const u of updates) {
          actions.updateObject(u.id, { x: u.x, y: u.y }, false);
        }
      },
      onObjectMoveEnd: (updates) => {
        for (const u of updates) {
          actions.updateObject(u.id, { x: u.x, y: u.y }, true);
        }
      },
      onObjectResize: (updates) => {
        for (const u of updates) {
          actions.updateObject(
            u.id,
            { x: u.x, y: u.y, width: u.width, height: u.height },
            false
          );
        }
      },
      onObjectResizeEnd: (updates) => {
        for (const u of updates) {
          actions.updateObject(
            u.id,
            { x: u.x, y: u.y, width: u.width, height: u.height },
            true
          );
        }
      },
      onPlace: (world, hitId) => {
        void actions.createAt(world, { hitId });
      },
      onFling: (id, vx, vy) => actions.flingObject(id, vx, vy),
      onEditText: (id) => actions.setEditingTextId(id),
      onStrokeComplete: (points, targetShapeId) => {
        actions.createStroke(points, targetShapeId);
      },
    });

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      instance.applyChanges(refs.dirty, refs.removed);
      instance.render();
    };

    void instance.init(host, getCurrentTheme()).then(() => {
      if (cancelled) {
        instance.destroy();
        return;
      }
      instance.attachSource(refs.objects);
      // Seed the dirty queue so anything already in the room paints on the first
      // frame, even if CRDT observers fired before the engine was ready.
      for (const id of refs.objects.keys()) refs.dirty.add(id);
      setZoomHandle(refs, (zoom) => instance.setZoom(zoom));
      setViewportCenterHandle(refs, () => {
        const b = instance.getWorldBounds();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
      instance.setTool(store.getState().tool);
      instance.setSelectedIds(store.getState().selectedIds);
      instance.syncCursors(store.getState().remotes);
      setEngine(instance);
      raf = requestAnimationFrame(loop);
    });

    // Subscribing to the store directly keeps these updates out of React's
    // render path entirely.
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.tool !== previous.tool) instance.setTool(state.tool);
      if (state.selectedIds !== previous.selectedIds) {
        instance.setSelectedIds(state.selectedIds);
      }
      if (state.replayObjects !== previous.replayObjects) {
        instance.setOverlayObjects(state.replayObjects);
      }
      if (state.editingTextId !== previous.editingTextId) {
        instance.setEditingId(state.editingTextId);
      }
      if (state.remotes !== previous.remotes) instance.syncCursors(state.remotes);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      unsubscribe();
      setZoomHandle(refs, null);
      setViewportCenterHandle(refs, null);
      setEngine(null);
      instance.destroy();
    };
  }, [store, refs, actions]);

  return (
    <div className="absolute inset-0 touch-none">
      <div ref={hostRef} className="absolute inset-0" />
      {editingObj && engine && (
        <TextEditorOverlay
          obj={editingObj}
          engine={engine}
          onChange={(text) => {
            actions.updateObject(editingObj.id, { props: { text } });
          }}
          onClose={() => actions.setEditingTextId(null)}
        />
      )}
    </div>
  );
}
