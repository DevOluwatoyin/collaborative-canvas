"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: replaces the root layout, so it must render its own
 * <html> and <body> and cannot rely on the app's fonts or CSS variables. Styles
 * here are inline for that reason.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[orbitboard] fatal error:", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f5f0",
          color: "#1a2330",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <title>Orbitboard — unexpected error</title>
        <main style={{ maxWidth: "30rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 0.75rem" }}>
            Orbitboard could not start
          </h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6, color: "#5b6573" }}>
            An unexpected error stopped the app from loading. Your boards are
            stored separately and are unaffected.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              border: "none",
              borderRadius: "1rem",
              padding: "0.85rem 1.4rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              background: "#0d9f90",
              color: "#06201d",
              cursor: "pointer",
            }}
          >
            Reload the app
          </button>
        </main>
      </body>
    </html>
  );
}
