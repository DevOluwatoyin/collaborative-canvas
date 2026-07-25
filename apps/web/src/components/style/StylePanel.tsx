"use client";

import { propNumber, propString } from "@infinite-canvas/shared";
import {
  useObject,
  useRoomActions,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import { CircleIcon, SquareIcon, TriangleIcon } from "@/components/ui/icons";
import { PALETTE, SIZES, colorPropFor, sizeFromFontSize } from "./styles";

const SIZE_LABEL: Record<string, string> = { s: "S", m: "M", l: "L", xl: "XL" };

const SHAPE_ICONS = [
  { kind: "rect" as const, label: "Rectangle", icon: <SquareIcon /> },
  { kind: "ellipse" as const, label: "Ellipse", icon: <CircleIcon /> },
  { kind: "triangle" as const, label: "Triangle", icon: <TriangleIcon /> },
];

/**
 * Right-hand style panel. It edits the selection when there is one and otherwise
 * edits the style that new objects inherit — so it is never inert, which is why
 * it can stay mounted rather than appearing only on selection.
 *
 * Every control here maps to a property the renderers and exporters actually
 * honour. Dash and fill styles are deliberately absent: the shape renderer has no
 * stroke-pattern support, and a row of controls that changed nothing would be
 * worse than no row.
 */
export function StylePanel() {
  const actions = useRoomActions();
  const selectedIds = useRoomState((s) => s.selectedIds);
  const tool = useRoomState((s) => s.tool);
  const shapeKind = useRoomState((s) => s.shapeKind);
  const styleColor = useRoomState((s) => s.styleColor);
  const styleSize = useRoomState((s) => s.styleSize);
  const styleOpacity = useRoomState((s) => s.styleOpacity);
  const selected = useObject(selectedIds[0] ?? null);

  // With a selection the panel reflects that object, so the swatches show what
  // you are about to change rather than a stale default.
  const colorProp = selected ? colorPropFor(selected.type) : null;
  const activeColor =
    selected && colorProp ? propString(selected.props, colorProp, styleColor) : styleColor;
  const activeSize = selected
    ? sizeFromFontSize(
        selected.type === "path"
          ? propNumber(selected.props, "strokeWidth", 3) * 5
          : propNumber(selected.props, "fontSize", 20)
      )
    : styleSize;
  const activeOpacity = selected ? (selected.opacity ?? 1) : styleOpacity;

  const showShapeKind = tool === "shape" || selected?.type === "shape";

  return (
    <div className="ui-card pointer-events-auto w-[196px] p-3">
      <div className="grid grid-cols-4 justify-items-center gap-2">
        {PALETTE.map((swatch) => (
          <button
            key={swatch.name}
            type="button"
            className="ui-swatch"
            style={{ background: swatch.hex }}
            title={swatch.name.replace("-", " ")}
            aria-label={`Colour ${swatch.name.replace("-", " ")}`}
            data-selected={
              activeColor.toLowerCase() === swatch.hex.toLowerCase() ? "true" : undefined
            }
            onClick={() => actions.setStyleColor(swatch.hex)}
          />
        ))}
      </div>

      <div className="ui-divider mt-3" />

      <label className="mt-1 block">
        <span className="ui-label">Opacity</span>
        <input
          className="ui-range mt-1"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={activeOpacity}
          aria-label="Opacity"
          onChange={(e) => actions.setStyleOpacity(Number(e.target.value), false)}
          // The drag writes without history; releasing records one op.
          onPointerUp={(e) => actions.setStyleOpacity(Number(e.currentTarget.value), true)}
          onKeyUp={(e) => actions.setStyleOpacity(Number(e.currentTarget.value), true)}
        />
      </label>

      <div className="ui-divider" />

      <div className="mt-1">
        <span className="ui-label">Size</span>
        <div className="mt-1 flex gap-0.5">
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className="ui-icon-btn flex-1 text-[13px] font-semibold"
              title={`Size ${SIZE_LABEL[size]}`}
              aria-pressed={activeSize === size}
              onClick={() => actions.setStyleSize(size)}
            >
              {SIZE_LABEL[size]}
            </button>
          ))}
        </div>
      </div>

      {showShapeKind && (
        <>
          <div className="ui-divider" />
          <div className="mt-1">
            <span className="ui-label">Shape</span>
            <div className="mt-1 flex gap-0.5">
              {SHAPE_ICONS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  className="ui-icon-btn flex-1"
                  title={s.label}
                  aria-label={s.label}
                  aria-pressed={
                    selected?.type === "shape"
                      ? propString(selected.props, "shape", "rect") === s.kind
                      : shapeKind === s.kind
                  }
                  onClick={() => {
                    actions.setShapeKind(s.kind);
                    if (selected?.type === "shape") {
                      actions.updateObject(selected.id, { props: { shape: s.kind } });
                    }
                  }}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="ui-divider" />

      <button
        type="button"
        className="ui-menu-item mt-1 justify-between"
        disabled={selectedIds.length === 0}
        onClick={actions.enablePhysicsOnSelected}
      >
        <span>Enable physics</span>
        <span className="ui-label">{selectedIds.length || ""}</span>
      </button>
    </div>
  );
}
