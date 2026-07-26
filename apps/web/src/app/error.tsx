"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level boundary. Catches render and data errors below the root layout so
 * a single broken feature shows recoverable UI instead of a blank page.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Digest is the only handle back to the server-side log entry.
    console.error("[orbitboard] route error:", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-warm)]">
        Something broke
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--foreground)]">
        This page hit an error
      </h1>
      <p className="ui-muted mt-4 text-sm leading-relaxed">
        Your board is stored locally and on the server, so nothing you made has
        been lost. Retrying re-renders this page without a full reload.
      </p>
      {error.digest && (
        <p className="ui-muted mt-2 font-mono text-xs">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#06201d] transition hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
