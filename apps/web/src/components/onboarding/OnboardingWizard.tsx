"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "orbitboard-onboarding-done";

const STEPS = [
  {
    title: "Welcome to Orbitboard",
    body: "A collaborative infinite canvas with physics, live presence, and creative tools. This short tour covers the essentials.",
    tip: "You can reopen this tour anytime from the Help button.",
  },
  {
    title: "Create & invite",
    body: "Use the toolbar to add text, shapes, stickies, images, audio, or freehand drawings. Share the room with Invite so teammates join instantly.",
    tip: "Shortcut: S shape · T text · D draw · V select",
  },
  {
    title: "Select, move & resize",
    body: "Drag a box or Shift+click to multi-select. Press Ctrl/Cmd+A to select everything. Drag to move; use corner handles to resize one object or the whole group.",
    tip: "Delete removes all currently selected objects.",
  },
  {
    title: "Draw freeform",
    body: "Pick Draw and sketch curves on the canvas. If a shape is selected, your stroke is attached to that shape as an annotation.",
    tip: "Pan with the scroll wheel; Ctrl/Cmd + scroll zooms.",
  },
  {
    title: "Physics, radar & more",
    body: "Enable Physics to fling and collide objects. Watch collaborators on the Radar minimap. Export JSON/SVG/PNG, go offline safely, or scrub Time Travel to replay the session.",
    tip: "You’re ready — start creating!",
  },
] as const;

export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Renders only while the tour is open — the parent mounts and unmounts it. That
 * replaces an effect that reset `step` whenever an `open` prop flipped, which is
 * the "reset state on prop change" anti-pattern: remounting does it for free.
 */
export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    markOnboardingDone();
    onClose();
  }, [onClose]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="ui-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="ui-muted text-xs font-semibold uppercase tracking-[0.18em]">
            Tour · {step + 1}/{STEPS.length}
          </p>
          <button
            type="button"
            className="ui-muted text-xs hover:text-[var(--foreground)]"
            onClick={finish}
          >
            Skip
          </button>
        </div>

        <div className="mb-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-[var(--accent)]" : "bg-[var(--chip)]"
              }`}
            />
          ))}
        </div>

        <h2
          id="onboarding-title"
          className="font-[family-name:var(--font-display)] text-2xl text-[var(--foreground)]"
        >
          {current.title}
        </h2>
        <p className="ui-muted mt-3 text-sm leading-relaxed">{current.body}</p>
        <p className="mt-4 rounded-xl bg-[var(--chip)] px-3 py-2 text-xs text-[var(--foreground)]">
          {current.tip}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--panel-hover)] disabled:opacity-40"
          >
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#06201d]"
            >
              Start creating
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#06201d]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
