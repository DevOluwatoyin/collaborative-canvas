import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Rooms are unlisted working documents reachable by link, so they are excluded
 * from indexing. The page component itself is a Client Component and cannot
 * export metadata; this segment layout carries it instead.
 */
export const metadata: Metadata = {
  title: "Board",
  robots: { index: false, follow: false, nocache: true },
};

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
