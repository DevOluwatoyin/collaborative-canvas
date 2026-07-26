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

/**
 * Every tool gets a permanent slot. Physics and audio started out behind the
 * caret, which made two of the app's headline features effectively invisible;
 * the popover now carries only shape kinds.
 */
const PRIMARY: ToolButton[] = [
  { tool: "select", label: "Select", hint: "V", icon: <CursorIcon /> },
  { tool: "pan", label: "Hand", hint: "H", icon: <HandIcon /> },
  { tool: "draw", label: "Draw", hint: "D", icon: <PencilIcon /> },
  { tool: "shape", label: "Shape", hint: "S", icon: <SquareIcon /> },
  { tool: "text", label: "Text", hint: "T", icon: <TextIcon /> },
  { tool: "sticky", label: "Note", hint: "N", icon: <NoteIcon /> },
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
      data-tour={`tool-${item.tool}`}
      title={`${item.label} — ${item.hint}`}
      aria-label={item.label}
      aria-pressed={active}
      onClick={onSelect}
    >
      {item.icon}
    </button>
  );
}

/** Bottom-centre tool strip. The chevron switches the active shape kind. */
export function ToolStrip() {
  const tool = useRoomState((s) => s.tool);
  const shapeKind = useRoomState((s) => s.shapeKind);
  const actions = useRoomActions();

  const activeShapeIcon =
    SHAPE_KINDS.find((s) => s.kind === shapeKind)?.icon ?? <SquareIcon />;

  return (
    <div
      data-tour="tools"
      className="ui-card pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 p-1"
    >
      {PRIMARY.map((item) => (
        <ToolItem
          key={item.tool}
          item={item.tool === "shape" ? { ...item, icon: activeShapeIcon } : item}
          active={tool === item.tool}
          // Image and audio act immediately instead of arming a tool: both need
          // a browser permission prompt (file dialog, microphone) that must be
          // opened from this click to count as a user gesture, and waiting for a
          // second click on the canvas made the icons feel unresponsive.
          onSelect={() => {
            if (item.tool === "image") actions.insertImage();
            else if (item.tool === "audio") actions.startAudioAtCenter();
            else actions.setTool(item.tool);
          }}
        />
      ))}

      <Popover
        label="Shape kinds"
        icon={<ChevronUpIcon />}
        placement="top-end"
        panelClassName="w-[172px]"
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
          </div>
        )}
      </Popover>
    </div>
  );
}
