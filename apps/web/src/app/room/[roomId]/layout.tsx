import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isValidRoomId } from "@infinite-canvas/shared";

/**
 * Rooms are unlisted working documents reachable by link, so they are excluded
 * from indexing. The page component itself is a Client Component and cannot
 * export metadata; this segment layout carries it instead.
 */
export const metadata: Metadata = {
  title: "Board",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  // Rejected here rather than in the client page so a bad id never mounts the
  // room, never opens a socket, and never creates a document for itself.
  if (!isValidRoomId(roomId)) notFound();
  return children;
}
