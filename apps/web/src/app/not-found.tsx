import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        404
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--foreground)]">
        This page doesn&apos;t exist
      </h1>
      <p className="ui-muted mt-4 text-sm leading-relaxed">
        The link may be mistyped, or the board it pointed to was never created.
        Room links look like <code>/room/&lt;id&gt;</code>.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#06201d] transition hover:brightness-110"
        >
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
