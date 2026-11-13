/**
 * Tour steps are anchored to real elements by `data-tour` attribute rather than
 * described in prose. A step whose target is not mounted (the style panel is
 * hidden on narrow viewports, the radar can be toggled off) is skipped, so the
 * tour never points at empty space.
 */
export type TourStep = {
  /** Value of the target's `data-tour` attribute; null centres the step. */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side to place the callout relative to the target. */
  side: "top" | "bottom" | "left" | "right";
};

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to Orbitboard",
    body: "A shared infinite canvas with physics, live presence and session replay. This tour points out where each of those lives — it takes about a minute.",
    side: "bottom",
  },
  {
    target: "tools",
    title: "Create with the toolbar",
    body: "Pick a tool, then click the canvas to place it. Shapes, sticky notes, text, images and voice clips all start here. Each tool has a single-key shortcut shown in its tooltip.",
    side: "top",
  },
  {
    target: "tool-shape",
    title: "Shapes and drawing",
    body: "The shape tool places rectangles, ellipses and triangles; open its caret to switch kind. The draw tool sketches freehand — with a shape selected, your stroke is attached to it as an annotation.",
    side: "top",
  },
  {
    target: "tool-physics",
    title: "Physics is the fun part",
    body: "Switch to the physics tool, then drag an object and release to fling it. Objects collide and carry momentum, and everyone in the room sees the same simulation.",
    side: "top",
  },
  {
    target: "style",
    title: "Style what you select",
    body: "Colour, size and opacity apply to the current selection, or set the default for what you create next. The physics section at the bottom turns bodies on and switches attract, repel and gravity for the whole room.",
    side: "left",
  },
  {
    target: "actions",
    title: "Undo, duplicate, arrange",
    body: "Undo and redo cover your own edits only — a collaborator's work is never rolled back by your undo. The menu here duplicates a selection and moves it in front of or behind everything else.",
    side: "top",
  },
  {
    target: "zoom",
    title: "Move around",
    body: "Scroll to pan, Ctrl or Cmd plus scroll to zoom, and space-drag to grab the canvas. This control resets you to 100% when you get lost.",
    side: "top",
  },
  {
    target: "radar",
    title: "See everyone at once",
    body: "The radar plots the whole board. Each collaborator's viewport is outlined in their colour, so you can tell who is working where even when they are far off-screen.",
    side: "top",
  },
  {
    target: "share",
    title: "Invite collaborators",
    body: "Copy the room link and send it. Anyone who opens it joins instantly as a guest — their cursor, name tag and edits appear live. Changes made while offline sync when the connection returns.",
    side: "bottom",
  },
  {
    target: "menu",
    title: "Everything else",
    body: "Exports to PNG, SVG and JSON, session time travel, and the option to leave or sign out all live in this menu. You can reopen this tour from here any time.",
    side: "bottom",
  },
];
