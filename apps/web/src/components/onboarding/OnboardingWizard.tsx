"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { TOUR_STEPS, type TourStep } from "./tourSteps";

const STORAGE_KEY = "orbitboard-onboarding-done";
const CALLOUT_WIDTH = 320;
const GAP = 14;
const MARGIN = 12;

export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage denied; the tour will simply offer itself again next visit.
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored: reopening from the menu does not depend on storage.
  }
}

type Box = { top: number; left: number; width: number; height: number };

function readTarget(step: TourStep): Box | null {
  if (!step.target) return null;
  const node = document.querySelector(`[data-tour="${step.target}"]`);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Places the callout on the requested side, clamped inside the viewport. */
function calloutPosition(box: Box | null, side: TourStep["side"]) {
  if (!box) {
    return {
      left: (window.innerWidth - CALLOUT_WIDTH) / 2,
      top: Math.max(MARGIN, window.innerHeight / 2 - 140),
    };
  }
  let left = box.left + box.width / 2 - CALLOUT_WIDTH / 2;
  let top = box.top + box.height + GAP;

  if (side === "top") top = box.top - GAP - 190;
  if (side === "left") {
    left = box.left - CALLOUT_WIDTH - GAP;
    top = box.top;
  }
  if (side === "right") {
    left = box.left + box.width + GAP;
    top = box.top;
  }

  return {
    left: Math.min(
      Math.max(MARGIN, left),
      Math.max(MARGIN, window.innerWidth - CALLOUT_WIDTH - MARGIN)
    ),
    top: Math.min(Math.max(MARGIN, top), Math.max(MARGIN, window.innerHeight - 210)),
  };
}

/**
 * Guided tour that highlights the actual control it is describing.
 *
 * Steps whose target is not on screen — the style panel below `md`, the radar
 * when hidden — are dropped up front, so the tour never points at nothing and
 * never describes a feature the user cannot currently see.
 */
export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const steps = useMemo(
    () => TOUR_STEPS.filter((step) => !step.target || readTarget(step) !== null),
    []
  );
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? steps[0];
  const [box, setBox] = useState<Box | null>(null);

  // Measured before paint so the spotlight never renders a frame at the wrong
  // place, and re-measured on resize because every target is viewport-anchored.
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => setBox(readTarget(step));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  const finish = useCallback(() => {
    markOnboardingDone();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish, steps.length]);

  if (!step) return null;

  const isLast = index === steps.length - 1;
  const pos = calloutPosition(box, step.side);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      {/* A ring plus a hole-punch shadow highlights the target without covering
          it, so the control being described stays visible. */}
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
            boxShadow: "0 0 0 3px var(--ui-selected), 0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      <div
        className="ui-card absolute p-4 shadow-2xl"
        style={{ top: pos.top, left: pos.left, width: CALLOUT_WIDTH }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="ui-label text-[11px] font-semibold uppercase tracking-[0.16em]">
            {index + 1} / {steps.length}
          </p>
          <button
            type="button"
            className="ui-label text-[12px] hover:text-[var(--ui-fg)]"
            onClick={finish}
          >
            Skip tour
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="h-1 flex-1 rounded-full"
              style={{
                background: i <= index ? "var(--ui-selected)" : "var(--ui-hover)",
              }}
            />
          ))}
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-[19px] font-semibold">
          {step.title}
        </h2>
        <p className="ui-label mt-2 text-[13px] leading-relaxed">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="ui-menu-item w-auto px-3 py-1.5 text-[13px]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold"
            style={{ background: "var(--ui-selected)", color: "var(--ui-selected-fg)" }}
          >
            {isLast ? "Start creating" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
