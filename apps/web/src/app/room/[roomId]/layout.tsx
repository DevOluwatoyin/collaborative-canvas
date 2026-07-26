import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isValidRoomId } from "@infinite-canvas/shared";

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
  if (!isValidRoomId(roomId)) notFound();
  return children;
}
