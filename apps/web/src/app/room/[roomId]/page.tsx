"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { RoomApp } from "@/components/room/RoomApp";
import { setGuestIdentity } from "@/lib/auth/guest";
import { useGuestIdentity } from "@/lib/auth/useGuestIdentity";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const identity = useGuestIdentity();
  const [name, setName] = useState("");

  if (!identity) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--foreground)]">
          Join room
        </h1>
        <p className="ui-muted mt-2 text-sm">
          Pick a guest name to enter{" "}
          <span className="text-[var(--foreground)]">{roomId}</span>
        </p>
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setGuestIdentity(name.trim() || "Guest");
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Username"
            className="ui-input rounded-2xl px-4 py-3"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#06201d]"
          >
            Enter canvas
          </button>
          <button
            type="button"
            className="ui-muted text-sm hover:text-[var(--foreground)]"
            onClick={() => router.push("/")}
          >
            Back home
          </button>
        </form>
      </main>
    );
  }

  return <RoomApp roomId={roomId} />;
}
