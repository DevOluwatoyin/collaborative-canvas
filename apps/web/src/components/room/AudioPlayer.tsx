"use client";

import { useRef, useState } from "react";
import {
  propNumber,
  propString,
  type CanvasObject,
} from "@infinite-canvas/shared";
import { localMediaUrl } from "@/lib/media/remote";
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  MicIcon,
} from "@/components/ui/icons";
import { useObject, useRoomState } from "./RoomStoreProvider";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Floating playback bar for the selected audio clip. Selection is the trigger
 * so playing a clip is one click with the select tool — no extra affordance on
 * the canvas object itself.
 */
export function AudioPlayerBar() {
  const selectedIds = useRoomState((s) => s.selectedIds);
  const audioCapture = useRoomState((s) => s.audioCapture);
  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const obj = useObject(id);
  // Hidden while the recorder is open, so the two panels never stack.
  if (!obj || obj.type !== "audio" || audioCapture) return null;
  return <PlayerPanel key={obj.id} obj={obj} />;
}

function PlayerPanel({ obj }: { obj: CanvasObject }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState(() => propString(obj.props, "src"));
  const triedFallbackRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  // MediaRecorder webm blobs often report Infinity until fully buffered, so the
  // recorded duration stored on the object is the fallback.
  const [duration, setDuration] = useState(
    () => propNumber(obj.props, "durationMs", 0) / 1000
  );
  const [rateIndex, setRateIndex] = useState(2);

  const label = propString(obj.props, "label", "Audio clip");
  const rate = RATES[rateIndex];

  const seekTo = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : duration;
    const next = Math.max(0, Math.min(seconds, max || 0));
    try {
      el.currentTime = next;
    } catch {
      // Some blob recordings are not seekable before metadata settles.
    }
    setTime(next);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = rate;
      void el.play().catch(() => setFailed(true));
    } else {
      el.pause();
    }
  };

  const cycleRate = () => {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    const el = audioRef.current;
    if (el) el.playbackRate = RATES[next];
  };

  const onError = () => {
    if (triedFallbackRef.current) {
      setFailed(true);
      return;
    }
    triedFallbackRef.current = true;
    // Remote media unreachable — fall back to the locally cached blob, which
    // exists for clips recorded on this device.
    void localMediaUrl(obj.id).then((url) => {
      if (url) setSrc(url);
      else setFailed(true);
    });
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-20 z-40 -translate-x-1/2">
      <div className="ui-card flex items-center gap-2.5 px-4 py-2.5">
        {/* Rendered (not just constructed) so React manages its lifecycle and
            unselecting the clip reliably stops playback. */}
        <audio
          ref={audioRef}
          src={src || undefined}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onError={onError}
        />

        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          <MicIcon width={14} height={14} />
          <span className="max-w-[110px] truncate">{label}</span>
        </span>

        {failed ? (
          <span className="text-[13px] text-red-600 dark:text-red-400">
            Audio unavailable — the clip could not be loaded.
          </span>
        ) : (
          <>
            <button
              type="button"
              className="ui-icon-btn"
              title={`Back ${SKIP_SECONDS}s`}
              aria-label={`Back ${SKIP_SECONDS} seconds`}
              onClick={() => seekTo(time - SKIP_SECONDS)}
            >
              <SkipBackIcon width={15} height={15} />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: "var(--ui-selected)",
                color: "var(--ui-selected-fg)",
              }}
              title={playing ? "Pause" : "Play"}
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {playing ? (
                <PauseIcon width={15} height={15} />
              ) : (
                <PlayIcon width={15} height={15} />
              )}
            </button>
            <button
              type="button"
              className="ui-icon-btn"
              title={`Forward ${SKIP_SECONDS}s`}
              aria-label={`Forward ${SKIP_SECONDS} seconds`}
              onClick={() => seekTo(time + SKIP_SECONDS)}
            >
              <SkipForwardIcon width={15} height={15} />
            </button>

            <span className="font-mono text-[12px] tabular-nums opacity-70">
              {formatTime(time)}
            </span>
            <input
              className="ui-range w-36"
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              value={Math.min(time, duration || time)}
              aria-label="Seek"
              onChange={(e) => seekTo(Number(e.target.value))}
            />
            <span className="font-mono text-[12px] tabular-nums opacity-70">
              {formatTime(duration)}
            </span>

            <button
              type="button"
              className="ui-icon-btn w-auto px-2 text-[12px] font-semibold tabular-nums"
              title="Playback speed"
              aria-label={`Playback speed ${rate}x`}
              onClick={cycleRate}
            >
              {rate}x
            </button>
          </>
        )}
      </div>
    </div>
  );
}
