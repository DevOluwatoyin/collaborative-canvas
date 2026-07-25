"use client";

import type { ReactNode } from "react";
import type { ShapeKind, Tool } from "@infinite-canvas/shared";
import { useRoomActions, useRoomState } from "@/components/room/RoomStoreProvider";
import { Popover } from "@/components/ui/Popover";
import {
  ChevronUpIcon,
  CircleIcon,
  CursorIcon,
  HandIcon,
  ImageIcon,
  MicIcon,
  NoteIcon,
  PencilIcon,
  PhysicsIcon,
  SquareIcon,
  TextIcon,
  TriangleIcon,
} from "@/components/ui/icons";

type ToolButton = {
  tool: Tool;
  label: string;
  hint: string;
  icon: ReactNode;
};

/** Tools that earn a permanent slot; the rest live in the shapes popover. */
const PRIMARY: ToolButton[] = [
  { tool: "select", label: "Select", hint: "V", icon: <CursorIcon /> },
  { tool: "pan", label: "Hand", hint: "H", icon: <HandIcon /> },
  { tool: "draw", label: "Draw", hint: "D", icon: <PencilIcon /> },
  { tool: "shape", label: "Shape", hint: "S", icon: <SquareIcon /> },
  { tool: "text", label: "Text", hint: "T", icon: <TextIcon /> },
  { tool: "sticky", label: "Note", hint: "N", icon: <NoteIcon /> },
];

const SECONDARY: ToolButton[] = [
  { tool: "image", label: "Image", hint: "I", icon: <ImageIcon /> },
  { tool: "audio", label: "Audio note", hint: "A", icon: <MicIcon /> },
  { tool: "physics", label: "Physics", hint: "P", icon: <PhysicsIcon /> },
];

const SHAPE_KINDS: { kind: ShapeKind; label: string; icon: ReactNode }[] = [
  { kind: "rect", label: "Rectangle", icon: <SquareIcon /> },
  { kind: "ellipse", label: "Ellipse", icon: <CircleIcon /> },
  { kind: "triangle", label: "Triangle", icon: <TriangleIcon /> },
];

function ToolItem({
  item,
  active,
  onSelect,
}: {
  item: ToolButton;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ui-icon-btn"
      title={`${item.label} — ${item.hint}`}
      aria-label={item.label}
      aria-pressed={active}
      onClick={onSelect}
    >
      {item.icon}
    </button>
  );
}

/**
 * Bottom-centre tool strip. Frequently used tools sit inline; the chevron opens
 * the remaining tools plus the shape kinds, which keeps the strip narrow enough
 * to survive a phone viewport.
 */
export function ToolStrip() {
  const tool = useRoomState((s) => s.tool);
  const shapeKind = useRoomState((s) => s.shapeKind);
  const actions = useRoomActions();

  const activeShapeIcon =
    SHAPE_KINDS.find((s) => s.kind === shapeKind)?.icon ?? <SquareIcon />;

  return (
    <div className="ui-card pointer-events-auto flex items-center gap-0.5 p-1">
      {PRIMARY.map((item) => (
        <ToolItem
          key={item.tool}
          item={item.tool === "shape" ? { ...item, icon: activeShapeIcon } : item}
          active={tool === item.tool}
          onSelect={() => actions.setTool(item.tool)}
        />
      ))}

      <Popover
        label="More tools and shapes"
        icon={<ChevronUpIcon />}
        placement="top-end"
        panelClassName="w-[172px]"
        selected={SECONDARY.some((s) => s.tool === tool)}
      >
        {(close) => (
          <div>
            <p className="ui-label px-2 pb-1 pt-1">Shapes</p>
            <div className="grid grid-cols-4 gap-0.5">
              {SHAPE_KINDS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  className="ui-icon-btn"
                  title={s.label}
                  aria-label={s.label}
                  aria-pressed={tool === "shape" && shapeKind === s.kind}
                  onClick={() => {
                    actions.setShapeKind(s.kind);
                    actions.setTool("shape");
                    close();
                  }}
                >
                  {s.icon}
                </button>
              ))}
            </div>
            <div className="ui-divider" />
            <p className="ui-label px-2 pb-1">Tools</p>
            <div className="grid grid-cols-4 gap-0.5">
              {SECONDARY.map((item) => (
                <button
                  key={item.tool}
                  type="button"
                  className="ui-icon-btn"
                  title={`${item.label} — ${item.hint}`}
                  aria-label={item.label}
                  aria-pressed={tool === item.tool}
                  onClick={() => {
                    actions.setTool(item.tool);
                    close();
                  }}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}
