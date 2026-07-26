"use client";

import type { CanvasObject } from "@infinite-canvas/shared";
import { colorPatch, sizePatch, type SizeName } from "@/components/style/styles";
import { setForceMode, setGravity as setGravityMeta } from "@/lib/yjs/provider";
import type { AttractMode, RoomRefs, RoomStore } from "../store";
import { updateRoomObject, type Actor } from "../mutations";

/** Object types that carry editable text. */
const TEXTUAL = new Set<CanvasObject["type"]>(["text", "sticky", "shape"]);

/** Object types whose corner radius can be adjusted. */
const ROUNDABLE = new Set<CanvasObject["type"]>(["shape", "sticky", "image"]);

export type StyleActions = ReturnType<typeof createStyleActions>;

/**
 * Appearance controls. Each one edits the current selection when there is one
 * and otherwise records a default that newly created objects inherit, which is
 * what lets the style panel stay useful with nothing selected.
 */
export function createStyleActions(
  store: RoomStore,
  refs: RoomRefs,
  actor: () => Actor
) {
  /** Applies a patch to every selected object the predicate accepts. */
  function patchSelection(
    accepts: (obj: CanvasObject) => boolean,
    build: (obj: CanvasObject) => Partial<CanvasObject> | null,
    recordHistory = true
  ) {
    const bindings = refs.bindings;
    if (!bindings) return;
    const ids = store.getState().selectedIds;
    if (ids.length === 0) return;
    const who = actor();
    bindings.doc.transact(() => {
      for (const id of ids) {
        const obj = refs.objects.get(id);
        if (!obj || !accepts(obj)) continue;
        const patch = build(obj);
        if (patch) updateRoomObject(bindings, who, id, patch, recordHistory);
      }
    });
  }

  function setStyleColor(hex: string) {
    store.setState({ styleColor: hex });
    patchSelection(
      () => true,
      (obj) => {
        const props = colorPatch(obj.type, hex);
        return props ? { props } : null;
      }
    );
  }

  function setStyleSize(size: SizeName) {
    store.setState({ styleSize: size });
    patchSelection(
      () => true,
      (obj) => {
        const props = sizePatch(obj.type, size);
        return props ? { props } : null;
      }
    );
  }

  /** `commit` false while a slider is being dragged, true on release. */
  function setStyleOpacity(opacity: number, commit = true) {
    store.setState({ styleOpacity: opacity });
    patchSelection(() => true, () => ({ opacity }), commit);
  }

  function setCornerRadius(radius: number, commit = true) {
    store.setState({ styleCornerRadius: radius });
    patchSelection(
      (obj) => ROUNDABLE.has(obj.type),
      () => ({ props: { cornerRadius: radius } }),
      commit
    );
  }

  function setTextAlign(align: "left" | "center" | "right") {
    patchSelection(
      (obj) => TEXTUAL.has(obj.type),
      () => ({ props: { textAlign: align } })
    );
  }

  /** Toggles bold/italic from the first textual object in the selection. */
  function toggleTextFlag(flag: "bold" | "italic") {
    const ids = store.getState().selectedIds;
    const first = ids
      .map((id) => refs.objects.get(id))
      .find((obj) => obj && TEXTUAL.has(obj.type));
    const next = first?.props[flag] !== true;
    patchSelection(
      (obj) => TEXTUAL.has(obj.type),
      () => ({ props: { [flag]: next } })
    );
  }

  /**
   * Force settings are written to the document rather than local state: only the
   * elected host simulates, so a mode held by a non-host peer would do nothing.
   */
  function setAttractMode(attractMode: AttractMode) {
    if (!refs.bindings) return;
    setForceMode(refs.bindings.meta, attractMode);
  }

  function setGravityEnabled(on: boolean) {
    if (!refs.bindings) return;
    setGravityMeta(refs.bindings.meta, on);
  }

  return {
    setStyleColor,
    setStyleSize,
    setStyleOpacity,
    setCornerRadius,
    setTextAlign,
    toggleTextFlag,
    setAttractMode,
    setGravityEnabled,
  };
}
