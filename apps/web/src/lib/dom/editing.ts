/**
 * Shared test for "the user is typing right now".
 *
 * The canvas binds single-letter shortcuts to window, so every text surface has
 * to be excluded from them. Checking only `event.target` is not enough: clicking
 * the Pixi canvas moves focus to <body>, so a keystroke arriving moments later
 * reports body as the target even though a text editor is open on screen. Both
 * the event target and the active element are therefore consulted.
 */
export function isEditableElement(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
    return true;
  }
  if (node instanceof HTMLSelectElement) return true;
  return node.isContentEditable;
}

/** True when the event targets a text surface, or one currently holds focus. */
export function isTextEntry(event: { target: EventTarget | null }): boolean {
  return (
    isEditableElement(event.target) ||
    (typeof document !== "undefined" && isEditableElement(document.activeElement))
  );
}
