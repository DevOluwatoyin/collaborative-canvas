"use client";

import { useEffect, useMemo, useState } from "react";
import { replayToStep } from "@/lib/history/replay";
import { useRoomActions, useRoomState } from "@/components/room/RoomStoreProvider";

const PLAYBACK_INTERVAL_MS = 280;

/**
 * Scrubs the session op log. Step 0 is the session start — after compaction that
 * is the base snapshot rather than an empty canvas, so long sessions still
 * replay to a complete board instead of one missing its earliest objects.
 */
export function ReplayPanel({ onClose }: { onClose: () => void }) {
  const history = useRoomState((s) => s.history);
  const historyBase = useRoomState((s) => s.historyBase);
  const historyBaseCount = useRoomState((s) => s.historyBaseCount);
  const actions = useRoomActions();

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxStep = history.length;
  const clampedStep = Math.min(step, maxStep);
  // Derived during render, not in an effect: the snapshot is a pure function of
  // (base, ops, step), so an effect would only add a wasted extra render. Memoised
  // so unrelated re-renders do not hand the canvas a fresh array to re-index.
  const snapshot = useMemo(
    () => replayToStep(history, clampedStep, historyBase),
    [history, clampedStep, historyBase]
  );

  // The canvas overlay is external state, so pushing to it belongs in an effect.
  useEffect(() => {
    actions.setReplayObjects(snapshot);
  }, [actions, snapshot]);

  useEffect(() => () => actions.setReplayObjects(null), [actions]);

  // Reaching the end is derived, not stored: no effect has to switch `playing`
  // off, which is what previously made this a setState-inside-effect.
  const atEnd = clampedStep >= maxStep;
  const isPlaying = playing && !atEnd;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(
      () => setStep((s) => Math.min(maxStep, s + 1)),
      PLAYBACK_INTERVAL_MS
    );
    return () => clearTimeout(timer);
  }, [isPlaying, clampedStep, maxStep]);

  const currentOp = clampedStep > 0 ? history[clampedStep - 1] : null;

  return (
    <div className="ui-panel absolute inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-2xl p-4 md:inset-x-auto md:right-4 md:left-auto md:w-[28rem]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--foreground)]">
            Time Travel
          </h2>
          <p className="ui-muted text-xs">
            Playing back on the canvas — live room is unchanged.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            onClose();
          }}
          className="rounded-lg px-2 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
        >
          Close
        </button>
      </div>

      <div className="mb-3 max-h-36 overflow-auto rounded-xl bg-[var(--chip)] p-2">
        {history.length === 0 ? (
          <p className="ui-muted text-xs">
            No recent history — create or move objects first.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            <li
              className={`flex justify-between gap-2 rounded px-1 py-0.5 ${
                clampedStep === 0
                  ? "bg-[var(--accent)]/25 font-medium text-[var(--foreground)]"
                  : "text-[var(--foreground)]"
              }`}
            >
              <span>
                0. session start
                {historyBaseCount > 0 ? ` (${historyBaseCount} ops compacted)` : ""}
              </span>
            </li>
            {history.map((op, i) => (
              <li
                key={op.id}
                className={`flex justify-between gap-2 rounded px-1 py-0.5 ${
                  i + 1 === clampedStep
                    ? "bg-[var(--accent)]/25 font-medium text-[var(--foreground)]"
                    : i + 1 < clampedStep
                      ? "text-[var(--foreground)]"
                      : "ui-muted"
                }`}
              >
                <span>
                  {historyBaseCount + i + 1}. {op.type}
                  {op.objectId ? ` · ${op.objectId.slice(0, 6)}` : ""}
                </span>
                <span className="ui-muted">{op.username}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="ui-muted mb-2 text-[11px]">
        Canvas objects at this step: <strong>{snapshot.length}</strong>
        {currentOp
          ? ` · ${currentOp.username} ${currentOp.type} @ ${new Date(
              currentOp.timestamp
            ).toLocaleTimeString()}`
          : ""}
      </p>

      <input
        type="range"
        min={0}
        max={maxStep}
        value={clampedStep}
        aria-label="Session timeline"
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
        className="w-full accent-[var(--accent)]"
      />
      <div className="ui-muted mt-2 flex items-center justify-between text-xs">
        <span>
          Step {clampedStep} / {maxStep}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-[var(--chip)] px-3 py-1 text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
            onClick={() => {
              if (maxStep === 0) return;
              // Pressing play at the end restarts from the session start.
              if (atEnd) setStep(0);
              setPlaying(!isPlaying);
            }}
            disabled={maxStep === 0}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--chip)] px-3 py-1 text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
            onClick={() => {
              setPlaying(false);
              setStep(0);
            }}
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
