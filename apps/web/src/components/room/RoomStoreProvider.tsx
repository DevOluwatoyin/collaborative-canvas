"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import type * as Y from "yjs";
import type { CanvasObject } from "@infinite-canvas/shared";
import { ensureGuestIdentity } from "@/lib/auth/guest";
import {
  createRoomBindings,
  destroyRoomBindings,
  getHistoryBase,
  getHistoryBaseCount,
  getRemotePresence,
} from "@/lib/yjs/provider";
import { changedObjectIds, readObject } from "@/lib/yjs/objects";
import { createPhysicsBridge } from "@/lib/physics/engine";
import { releaseLocalMediaUrls } from "@/lib/media/remote";
import { createRoomActions, type RoomActions } from "./actions";
import {
  attachRoomInfra,
  createObjectReader,
  createObjectsReader,
  createRoomRefs,
  createRoomStore,
  createStoreSubscriber,
  detachRoomInfra,
  resetObjects,
  stageObject,
  stageRemoval,
  type RoomRefs,
  type RoomState,
  type RoomStore,
} from "./store";
import { useHostLoop } from "./useHostLoop";

/**
 * React-facing state is refreshed on a throttle. Nothing in the UI needs
 * object-level updates at simulation rate — the canvas reads the mutable map
 * directly — so panels settle at ~5Hz instead of ~20Hz.
 */
const UI_REFRESH_MS = 200;

type RoomContextValue = {
  store: RoomStore;
  refs: RoomRefs;
  actions: RoomActions;
  subscribe: (onChange: () => void) => () => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("Room hooks must be used within RoomStoreProvider");
  return ctx;
}

/** Subscribe to a slice of room state. Re-renders only when the slice changes. */
export function useRoomState<T>(selector: (state: RoomState) => T): T {
  const { store } = useRoomContext();
  return useStore(store, selector);
}

export function useRoomActions(): RoomActions {
  return useRoomContext().actions;
}

/** Escape hatch for imperative consumers (the Pixi stage) that avoid React. */
export function useRoomHandles(): { store: RoomStore; refs: RoomRefs } {
  const { store, refs } = useRoomContext();
  return { store, refs };
}

/**
 * Reads live object data outside the hot path. The objects live in a mutable map,
 * so they are consumed as an external store keyed on `revision` — which the
 * provider bumps at most every UI_REFRESH_MS.
 */
export function useObjectsSnapshot(): CanvasObject[] {
  const { store, refs, subscribe } = useRoomContext();
  const [reader] = useState(() => createObjectsReader(refs));
  return useSyncExternalStore(
    subscribe,
    () => reader.read(store.getState().revision),
    reader.server
  );
}

export function useObject(id: string | null): CanvasObject | null {
  const { store, refs, subscribe } = useRoomContext();
  const [reader] = useState(() => createObjectReader(refs));
  return useSyncExternalStore(
    subscribe,
    () => reader.read(store.getState().revision, id),
    reader.server
  );
}

export function RoomStoreProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  // Created once per room; identity comes from localStorage, so it must not run
  // during render on the server.
  const [context] = useState<RoomContextValue>(() => {
    const identity = ensureGuestIdentity();
    const store = createRoomStore(roomId, identity);
    const refs = createRoomRefs();
    return {
      store,
      refs,
      actions: createRoomActions(store, refs),
      subscribe: createStoreSubscriber(store),
    };
  });

  useRoomWiring(context);
  useHostLoop(context.store, context.refs);

  return <RoomContext.Provider value={context}>{children}</RoomContext.Provider>;
}

/**
 * Connects the CRDT document to the store. This is the one place an effect is
 * the right tool: it subscribes to an external system and pushes updates in via
 * callbacks rather than computing state during render.
 */
function useRoomWiring({ store, refs }: RoomContextValue) {
  useEffect(() => {
    const { roomId, identity } = store.getState();
    const bindings = createRoomBindings(roomId, identity);
    const physics = createPhysicsBridge();
    attachRoomInfra(refs, bindings, physics);

    let uiTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingRevision = false;

    const flushRevision = () => {
      uiTimer = null;
      if (!pendingRevision) return;
      pendingRevision = false;
      store.setState((state) => ({
        revision: state.revision + 1,
        objectCount: refs.objects.size,
      }));
    };

    const scheduleRevision = () => {
      pendingRevision = true;
      uiTimer ??= setTimeout(flushRevision, UI_REFRESH_MS);
    };

    /** Materialise every object once, on load or after an IndexedDB restore. */
    const primeObjects = () => {
      resetObjects(refs);
      bindings.objects.forEach((y) => stageObject(refs, readObject(y)));
      scheduleRevision();
    };

    const onObjects = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      const { changed, removed } = changedObjectIds(events);
      for (const id of removed) stageRemoval(refs, id);
      for (const id of changed) {
        const y = bindings.objects.get(id);
        if (y) stageObject(refs, readObject(y));
        else stageRemoval(refs, id);
      }
      scheduleRevision();
    };

    const onHistory = () => {
      store.setState({ history: bindings.history.toArray() });
    };

    const onMeta = () => {
      store.setState({
        historyBase: getHistoryBase(bindings.meta),
        historyBaseCount: getHistoryBaseCount(bindings.meta),
      });
    };

    const onPresence = () => {
      const remotes = getRemotePresence(bindings.awareness, identity.id);
      const clientIds = Array.from(bindings.awareness.getStates().keys()).sort(
        (a, b) => a - b
      );
      // Lowest awareness client id owns the simulation. Every peer computes this
      // from the same replicated state, so exactly one of them agrees it is host.
      const isHost =
        clientIds.length === 0 || clientIds[0] === bindings.awareness.clientID;
      store.setState({ remotes, isHost });
    };

    const onStatus = ({ status }: { status: string }) => {
      store.setState({ connected: status === "connected" });
    };

    const onSync = (isSynced: boolean) => {
      store.setState({ synced: isSynced });
    };

    const onOnline = () => store.setState({ online: true });
    const onOffline = () => store.setState({ online: false });

    bindings.objects.observeDeep(onObjects);
    bindings.history.observe(onHistory);
    bindings.meta.observe(onMeta);
    bindings.awareness.on("change", onPresence);
    bindings.provider.on("status", onStatus);
    bindings.provider.on("sync", onSync);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (bindings.persistence) {
      bindings.persistence.once("synced", () => {
        primeObjects();
        onHistory();
        onMeta();
        store.setState({ synced: true });
      });
    }

    primeObjects();
    onHistory();
    onMeta();
    onPresence();

    return () => {
      if (uiTimer) clearTimeout(uiTimer);
      bindings.objects.unobserveDeep(onObjects);
      bindings.history.unobserve(onHistory);
      bindings.meta.unobserve(onMeta);
      bindings.awareness.off("change", onPresence);
      bindings.provider.off("status", onStatus);
      bindings.provider.off("sync", onSync);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      physics.destroy();
      destroyRoomBindings(bindings);
      releaseLocalMediaUrls();
      detachRoomInfra(refs);
    };
  }, [store, refs]);
}
