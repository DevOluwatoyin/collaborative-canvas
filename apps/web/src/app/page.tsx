"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { nanoid } from "nanoid";
import { setGuestIdentity } from "@/lib/auth/guest";
import { useGuestIdentity } from "@/lib/auth/useGuestIdentity";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function HomePage() {
  const router = useRouter();
  const identity = useGuestIdentity();
  // Uncontrolled-until-edited: the stored username is the default, so no effect
  // is needed to copy external state into a state variable.
  const [draftName, setDraftName] = useState<string | null>(null);
  const username = draftName ?? identity?.username ?? "";
  const [joinId, setJoinId] = useState("");

  function ensureUser() {
    const name = username.trim() || "Guest";
    setGuestIdentity(name);
    setDraftName(name);
    return name;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    ensureUser();
    const id = nanoid(10);
    router.push(`/room/${id}`);
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    ensureUser();
    const id = joinId.trim().replace(/^.*\//, "");
    if (!id) return;
    router.push(`/room/${id}`);
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[var(--accent-warm)]/15 blur-3xl" />
      </div>

      <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
        Real-time · Physics · Offline-ready
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight text-[var(--foreground)] md:text-7xl">
        Orbitboard
      </h1>
      <p className="ui-muted mt-5 max-w-xl text-base md:text-lg">
        An infinite collaborative canvas where objects bounce, attract, and
        remember every move — share a link and create together.
      </p>

      <form onSubmit={onCreate} className="mt-10 flex max-w-md flex-col gap-3">
        <label className="ui-muted text-xs font-medium uppercase tracking-wider">
          Guest username
        </label>
        <input
          value={username}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="e.g. Ada"
          className="ui-input rounded-2xl px-4 py-3"
          maxLength={32}
        />
        <button
          type="submit"
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#06201d] transition hover:brightness-110"
        >
          Create a room
        </button>
      </form>

      <form onSubmit={onJoin} className="mt-8 flex max-w-md flex-col gap-3">
        <label className="ui-muted text-xs font-medium uppercase tracking-wider">
          Or join with room id / link
        </label>
        <div className="flex gap-2">
          <input
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Room id or pasted URL"
            className="ui-input flex-1 rounded-2xl px-4 py-3"
          />
          <button
            type="submit"
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
          >
            Join
          </button>
        </div>
      </form>

      <ul className="ui-muted mt-14 grid gap-4 text-sm md:grid-cols-3">
        <li className="rounded-2xl border border-[var(--border)] bg-[var(--chip)] p-4">
          Infinite canvas with smooth pan & zoom
        </li>
        <li className="rounded-2xl border border-[var(--border)] bg-[var(--chip)] p-4">
          Matter.js physics — fling, collide, attract
        </li>
        <li className="rounded-2xl border border-[var(--border)] bg-[var(--chip)] p-4">
          Radar, offline sync, export & time travel
        </li>
      </ul>
    </main>
  );
}
