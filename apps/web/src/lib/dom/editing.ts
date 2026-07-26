/**
 * Shared test for "the user is typing right now", used to suppress the canvas's
 * single-letter shortcuts. Both the event target and the active element are
 * consulted: a canvas click moves focus to <body>, so the target alone reports no
 * text surface even while an editor is open.
 */
function isEditableElement(node: EventTarget | null): boolean {
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
