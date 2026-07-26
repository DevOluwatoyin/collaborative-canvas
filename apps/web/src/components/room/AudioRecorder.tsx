"use client";

import { useEffect, useRef, useState } from "react";
import { MicrophoneError, startAudioRecording, type RecorderHandle } from "./media";
import { useRoomActions, useRoomState } from "./RoomStoreProvider";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Visible recording mode: opens when the audio tool places a clip, shows a live
 * timer, and stops only when asked. Keyed by capture id so each recording starts
 * from fresh state by mounting rather than by resetting state in an effect.
 */
export function AudioRecorder() {
  const capture = useRoomState((s) => s.audioCapture);
  if (!capture) return null;
  return <RecordingSession key={capture.id} />;
}

function RecordingSession() {
  const actions = useRoomActions();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<RecorderHandle | null>(null);

  useEffect(() => {
    let disposed = false;
    const startedAt = performance.now();
    const timer = setInterval(() => {
      setElapsed(performance.now() - startedAt);
    }, 200);

    void (async () => {
      try {
        const handle = await startAudioRecording();
        if (disposed) {
          handle.cancel();
          return;
        }
        handleRef.current = handle;
        const recording = await handle.done;
        handleRef.current = null;
        if (disposed || !recording) return;
        await actions.commitAudioCapture(recording.blob, recording.durationMs);
      } catch (err) {
        if (disposed) return;
        setError(
          err instanceof MicrophoneError ? err.message : "Recording failed to start."
        );
      }
    })();

    return () => {
      disposed = true;
      clearInterval(timer);
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, [actions]);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-20 z-40 -translate-x-1/2">
      <div className="ui-card flex items-center gap-3 px-4 py-3">
        {error ? (
          <>
            <span className="text-[13px] text-red-600 dark:text-red-400">{error}</span>
            <button
              type="button"
              className="ui-menu-item w-auto justify-center px-3 py-1.5 text-[13px] font-semibold"
              onClick={actions.cancelAudioCapture}
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-[13px] font-medium">Recording</span>
            <span className="font-mono text-[13px] tabular-nums opacity-70">
              {formatElapsed(elapsed)}
            </span>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }}
              onClick={() => handleRef.current?.stop()}
            >
              Stop &amp; place
            </button>
            <button
              type="button"
              className="ui-menu-item w-auto px-3 py-1.5 text-[13px]"
              onClick={actions.cancelAudioCapture}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
