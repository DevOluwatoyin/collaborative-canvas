"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "orbitboard-onboarding-done";

const STEPS = [
  {
    title: "Welcome to Orbitboard",
    body: "A collaborative infinite canvas with physics, live presence, and creative tools. This short tour covers the essentials.",
    tip: "Reopen this tour anytime from the menu beside the Orbitboard name.",
  },
  {
    title: "Create & invite",
    body: "Pick a tool from the strip at the bottom of the screen — shapes, text, notes, images, audio or freehand. Hit Share, top right, to bring teammates in.",
    tip: "Shortcuts: V select · H hand · D draw · S shape · T text · N note",
  },
  {
    title: "Select, move & resize",
    body: "Drag a box or Shift+click to multi-select. Press Ctrl/Cmd+A to select everything. Drag to move; use corner handles to resize one object or the whole group.",
    tip: "Ctrl/Cmd+D duplicates, Ctrl/Cmd+Z undoes, Delete removes the selection.",
  },
  {
    title: "Draw freeform",
    body: "Pick Draw and sketch curves on the canvas. If a shape is selected, your stroke is attached to that shape as an annotation.",
    tip: "Pan with the scroll wheel; Ctrl/Cmd + scroll zooms.",
  },
  {
    title: "Physics, radar & more",
    body: "Set colour, opacity and size in the panel on the right. Enable physics there to fling and collide objects. Exports and Time Travel live in the menu, top left.",
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
        className="ui-card w-full max-w-lg p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="ui-label text-xs font-semibold uppercase tracking-[0.18em]">
            Tour · {step + 1}/{STEPS.length}
          </p>
          <button
            type="button"
            className="ui-label text-xs hover:text-[var(--ui-fg)]"
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
                i <= step ? "bg-[var(--accent)]" : "bg-[var(--ui-hover)]"
              }`}
            />
          ))}
        </div>

        <h2
          id="onboarding-title"
          className="font-[family-name:var(--font-display)] text-2xl text-[var(--ui-fg)]"
        >
          {current.title}
        </h2>
        <p className="ui-label mt-3 text-sm leading-relaxed">{current.body}</p>
        <p className="mt-4 rounded-xl bg-[var(--ui-hover)] px-3 py-2 text-xs text-[var(--ui-fg)]">
          {current.tip}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl px-4 py-2 text-sm text-[var(--ui-fg)] hover:bg-[var(--ui-hover)] disabled:opacity-40"
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
