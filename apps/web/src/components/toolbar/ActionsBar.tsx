"use client";

import { useRoomActions, useRoomState } from "@/components/room/RoomStoreProvider";
import { Popover } from "@/components/ui/Popover";
import {
  BringToFrontIcon,
  DuplicateIcon,
  MoreIcon,
  RedoIcon,
  SelectAllIcon,
  SendToBackIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/ui/icons";

/**
 * Edit actions, kept separate from the tool strip so the tools row never changes
 * width as the selection comes and goes.
 */
export function ActionsBar() {
  const actions = useRoomActions();
  const canUndo = useRoomState((s) => s.canUndo);
  const canRedo = useRoomState((s) => s.canRedo);
  const hasSelection = useRoomState((s) => s.selectedIds.length > 0);

  return (
    <div
      data-tour="actions"
      className="ui-card pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 p-1"
    >
      <button
        type="button"
        className="ui-icon-btn"
        title="Undo — Ctrl/Cmd+Z"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={actions.undo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="ui-icon-btn"
        title="Redo — Ctrl/Cmd+Shift+Z"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={actions.redo}
      >
        <RedoIcon />
      </button>
      <button
        type="button"
        className="ui-icon-btn"
        title="Duplicate — Ctrl/Cmd+D"
        aria-label="Duplicate selection"
        disabled={!hasSelection}
        onClick={actions.duplicateSelected}
      >
        <DuplicateIcon />
      </button>
      <button
        type="button"
        className="ui-icon-btn"
        title="Delete — Del"
        aria-label="Delete selection"
        disabled={!hasSelection}
        onClick={actions.removeSelected}
      >
        <TrashIcon />
      </button>

      <Popover
        label="More actions"
        icon={<MoreIcon />}
        placement="top-end"
        panelClassName="w-[184px]"
      >
        {(close) => (
          <div>
            <button
              type="button"
              className="ui-menu-item"
              onClick={() => {
                actions.selectAll();
                close();
              }}
            >
              <SelectAllIcon />
              Select all
              <span className="ui-label ml-auto">Ctrl A</span>
            </button>
            <div className="ui-divider" />
            <button
              type="button"
              className="ui-menu-item"
              disabled={!hasSelection}
              onClick={() => {
                actions.reorderSelected("front");
                close();
              }}
            >
              <BringToFrontIcon />
              Bring to front
            </button>
            <button
              type="button"
              className="ui-menu-item"
              disabled={!hasSelection}
              onClick={() => {
                actions.reorderSelected("back");
                close();
              }}
            >
              <SendToBackIcon />
              Send to back
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
}
