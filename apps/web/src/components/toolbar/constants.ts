"use client";

import type { Tool } from "@infinite-canvas/shared";

export const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "pan", label: "Pan", hint: "H" },
  { id: "draw", label: "Draw", hint: "D" },
  { id: "text", label: "Text", hint: "T" },
  { id: "shape", label: "Shape", hint: "S" },
  { id: "sticky", label: "Sticky", hint: "N" },
  { id: "image", label: "Image", hint: "I" },
  { id: "audio", label: "Audio", hint: "A" },
  { id: "physics", label: "Physics", hint: "P" },
];

export const chromeBtn =
  "rounded-xl px-2.5 py-1.5 text-xs text-[var(--foreground)] transition hover:bg-[var(--panel-hover)] md:text-sm";
