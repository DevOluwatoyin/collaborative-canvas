"use client";

import { useState } from "react";
import {
  propNumber,
  propString,
  STICKY_RADIUS,
  textAlignOf,
} from "@infinite-canvas/shared";
import {
  useObject,
  useRoomActions,
  useRoomState,
} from "@/components/room/RoomStoreProvider";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronUpIcon,
  CloseIcon,
  ItalicIcon,
  CircleIcon,
  SquareIcon,
  TriangleIcon,
} from "@/components/ui/icons";
import { PALETTE, SIZES, colorPropFor, sizeFromFontSize } from "./styles";

const SIZE_LABEL: Record<string, string> = { s: "S", m: "M", l: "L", xl: "XL" };

const FORCE_MODES = ["none", "attract", "repel"] as const;

const FORCE_HINTS: Record<(typeof FORCE_MODES)[number], string> = {
  none: "No forces between physics bodies",
  attract: "Physics bodies pull towards each other",
  repel: "Physics bodies push each other apart",
};

const TEXT_ALIGNMENTS = [
  { value: "left" as const, label: "Align left", icon: <AlignLeftIcon /> },
  { value: "center" as const, label: "Align centre", icon: <AlignCenterIcon /> },
  { value: "right" as const, label: "Align right", icon: <AlignRightIcon /> },
];

const SHAPE_ICONS = [
  { kind: "rect" as const, label: "Rectangle", icon: <SquareIcon /> },
  { kind: "ellipse" as const, label: "Ellipse", icon: <CircleIcon /> },
  { kind: "triangle" as const, label: "Triangle", icon: <TriangleIcon /> },
];

/**
 * Right-hand style panel. Edits the selection when there is one, otherwise the
 * style new objects inherit, so it is never inert. Every control maps to a
 * property the renderers and exporters honour; dash and fill styles are absent
 * because the shape renderer has no stroke-pattern support.
 */
export function StylePanel({ onClose }: { onClose?: () => void }) {
  const actions = useRoomActions();
  const selectedIds = useRoomState((s) => s.selectedIds);
  const tool = useRoomState((s) => s.tool);
  const shapeKind = useRoomState((s) => s.shapeKind);
  const styleColor = useRoomState((s) => s.styleColor);
  const styleSize = useRoomState((s) => s.styleSize);
  const styleOpacity = useRoomState((s) => s.styleOpacity);
  const styleCornerRadius = useRoomState((s) => s.styleCornerRadius);
  const attractMode = useRoomState((s) => s.attractMode);
  const gravity = useRoomState((s) => s.gravity);
  const physicsCount = useRoomState((s) => s.physicsCount);
  const isHost = useRoomState((s) => s.isHost);
  const selected = useObject(selectedIds[0] ?? null);
  const physicsOnSelection = selected?.physics?.enabled === true;

  // Open by default — the palette is a primary control. Collapsing it is the
  // quickest way to shorten the panel when the other sections are in use.
  const [colorOpen, setColorOpen] = useState(true);

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

  // Text controls apply to anything that carries a label.
  const showTextStyle =
    selected?.type === "text" ||
    selected?.type === "sticky" ||
    selected?.type === "shape";
  const activeAlign = selected
    ? textAlignOf(selected.props, selected.type === "shape" ? "center" : "left")
    : "left";

  // Only rectangles, stickies and images have corners to round; hiding the
  // control for ellipses and triangles keeps it from looking broken.
  const isRoundable =
    selected?.type === "sticky" ||
    selected?.type === "image" ||
    (selected?.type === "shape" &&
      propString(selected.props, "shape", "rect") === "rect");
  const showCornerRadius =
    isRoundable || (!selected && tool === "shape" && shapeKind === "rect");
  const activeRadius = selected
    ? propNumber(
        selected.props,
        "cornerRadius",
        selected.type === "sticky" ? STICKY_RADIUS : 0
      )
    : styleCornerRadius;

  return (
    // The panel is capped to the viewport and scrolls internally. Left
    // unbounded it grew past the bottom of the screen as sections were added,
    // pushing the physics controls off-screen and under the radar, where they
    // could not be clicked at all.
    <div
      data-tour="style"
      className="ui-card ui-noscrollbar pointer-events-auto max-h-[calc(100dvh-6.5rem)] w-[196px] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-3"
    >
      {onClose && (
        <div className="mb-1 flex items-center justify-between md:hidden">
          <span className="ui-label font-semibold">Style</span>
          <button
            type="button"
            className="ui-icon-btn h-7 w-7"
            title="Close"
            aria-label="Close style panel"
            onClick={onClose}
          >
            <CloseIcon width={15} height={15} />
          </button>
        </div>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg py-0.5"
        aria-expanded={colorOpen}
        onClick={() => setColorOpen((v) => !v)}
        title={colorOpen ? "Hide colours" : "Show colours"}
      >
        <span className="ui-label">Colour</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: activeColor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }}
          />
          <ChevronUpIcon
            width={14}
            height={14}
            className={colorOpen ? "" : "rotate-180"}
            style={{ transition: "transform .15s ease" }}
          />
        </span>
      </button>

      {colorOpen && (
        <div className="mt-2 grid grid-cols-4 justify-items-center gap-2">
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
      )}

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

      {showCornerRadius && (
        <>
          <div className="ui-divider" />
          <label className="mt-1 block">
            <span className="ui-label">Corner radius</span>
            <input
              className="ui-range mt-1"
              type="range"
              min={0}
              max={60}
              step={1}
              value={activeRadius}
              aria-label="Corner radius"
              onChange={(e) => actions.setCornerRadius(Number(e.target.value), false)}
              onPointerUp={(e) => actions.setCornerRadius(Number(e.currentTarget.value), true)}
              onKeyUp={(e) => actions.setCornerRadius(Number(e.currentTarget.value), true)}
            />
          </label>
        </>
      )}

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

      {showTextStyle && (
        <>
          <div className="ui-divider" />
          <div className="mt-1">
            <span className="ui-label">Text</span>
            <div className="mt-1 flex gap-0.5">
              <button
                type="button"
                className="ui-icon-btn flex-1"
                title="Bold"
                aria-label="Bold"
                aria-pressed={selected?.props.bold === true}
                onClick={() => actions.toggleTextFlag("bold")}
              >
                <BoldIcon />
              </button>
              <button
                type="button"
                className="ui-icon-btn flex-1"
                title="Italic"
                aria-label="Italic"
                aria-pressed={selected?.props.italic === true}
                onClick={() => actions.toggleTextFlag("italic")}
              >
                <ItalicIcon />
              </button>
            </div>
            <div className="mt-1 flex gap-0.5">
              {TEXT_ALIGNMENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className="ui-icon-btn flex-1"
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={activeAlign === a.value}
                  onClick={() => actions.setTextAlign(a.value)}
                >
                  {a.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="ui-divider" />

      <div className="px-1 pb-1">
        <div className="ui-label mb-1.5">Physics</div>
        <button
          type="button"
          className="ui-menu-item justify-between"
          disabled={selectedIds.length === 0}
          onClick={actions.togglePhysicsOnSelected}
          title="Give the selection a physics body so it can be flung and collide"
        >
          <span>{physicsOnSelection ? "Disable on selection" : "Enable on selection"}</span>
          <span className="ui-label">{selectedIds.length || ""}</span>
        </button>

        {/* Force settings are room-wide, and replicated: only the elected host
            simulates, so these must not be local-only toggles. */}
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {FORCE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className="flex-1 rounded-lg px-2 py-1 text-[12px] capitalize"
              style={
                attractMode === mode
                  ? { background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }
                  : { background: "var(--ui-hover)" }
              }
              onClick={() => actions.setAttractMode(mode)}
              title={FORCE_HINTS[mode]}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ui-menu-item mt-1 justify-between"
          onClick={() => actions.setGravityEnabled(!gravity)}
          title="Pull every physics body downwards"
        >
          <span>Gravity</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={
              gravity
                ? { background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }
                : { background: "var(--ui-hover)" }
            }
          >
            {gravity ? "on" : "off"}
          </span>
        </button>

        {/* Physics is easy to mistake for broken: bodies sit still until a force
            acts on them, and only the elected host simulates. Showing both makes
            the state legible instead of guesswork. */}
        <p className="ui-label mt-1.5 leading-snug">
          {physicsCount === 0
            ? "No active bodies yet."
            : `${physicsCount} active ${physicsCount === 1 ? "body" : "bodies"}`}
          {isHost ? " · simulating here" : " · simulated by a peer"}
        </p>
        <p className="ui-label mt-1.5 leading-snug">
          With the Physics tool, drag an object and let go to fling it.
        </p>
      </div>
    </div>
  );
}
