"use client";

import { useEffect } from "react";
import Link from "next/link";


export default function RoomError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[orbitboard] room error:", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--foreground)]">
        This board could not be opened
      </h1>
      <p className="ui-muted mt-4 text-sm leading-relaxed">
        The canvas needs WebGL, which some browsers disable in private windows or
        when hardware acceleration is off. Board content is safe on the collab
        server either way.
      </p>
      {error.digest && (
        <p className="ui-muted mt-2 font-mono text-xs">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
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
          Back to rooms
        </Link>
      </div>
    </main>
  );
}
