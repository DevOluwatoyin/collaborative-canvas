import type { CanvasObject, HistoryOp } from "@infinite-canvas/shared";
import { nanoid } from "nanoid";
import { appendHistory, type RoomBindings } from "@/lib/yjs/provider";
import {
  historyOpFromCreate,
  historyOpFromDelete,
  historyOpFromUpdate,
} from "@/lib/history/replay";
import type { Actor } from "./core";

/**
 * Records what an undo or redo actually changed as one batch op, so Time Travel
 * stays a truthful log. Without this the op log would still contain the create
 * that an undo just reverted, and replay would show a phantom object.
 */
export function recordUndoDiff(
  bindings: RoomBindings,
  actor: Actor,
  before: Map<string, CanvasObject>,
  after: Map<string, CanvasObject>,
  label: "undo" | "redo"
): void {
  const ops: HistoryOp[] = [];
  for (const [id, previous] of before) {
    const current = after.get(id);
    if (!current) {
      ops.push(historyOpFromDelete(id, actor.id, actor.username));
    } else if (current !== previous) {
      ops.push(historyOpFromUpdate(id, current, actor.id, actor.username));
    }
  }
  for (const [id, current] of after) {
    if (!before.has(id)) {
      ops.push(historyOpFromCreate(current, actor.id, actor.username));
    }
  }
  if (ops.length === 0) return;
  appendHistory(bindings.history, {
    id: `h-${nanoid(10)}`,
    type: "batch",
    payload: { ops, label },
    userId: actor.id,
    username: actor.username,
    timestamp: Date.now(),
  });
}
