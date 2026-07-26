"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/** History length is fixed for the lifetime of this page, so nothing to watch. */
const noopSubscribe = () => () => undefined;

/**
 * Returns to the previous entry in session history, rendered only when there is
 * one. On a cold load of a bad URL the stack is empty, and a back button that
 * does nothing is worse than no button.
 *
 * `useSyncExternalStore` rather than an effect: the value is browser-only, and
 * the server snapshot keeps it out of the prerendered HTML without a second
 * render pass.
 */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const canGoBack = useSyncExternalStore(
    noopSubscribe,
    () => window.history.length > 1,
    () => false
  );

  if (!canGoBack) return null;

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      Go back
    </button>
  );
}
