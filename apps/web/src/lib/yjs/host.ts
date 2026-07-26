import type { Awareness } from "y-protocols/awareness";
import type { PresenceState } from "@infinite-canvas/shared";

/**
 * A peer whose awareness state has not been refreshed within this window is
 * treated as gone. y-protocols re-announces the local state every 15s, so a live
 * peer is always well inside it.
 */
const STALE_PEER_MS = 20_000;

/**
 * Decides whether this peer owns the simulation.
 *
 * Candidates must be live — stale awareness states are ghosts left behind by
 * closed tabs — and visible peers win, since browsers pause animation frames in
 * background tabs. Ties break on lowest client id, which every peer computes
 * identically from replicated state, so exactly one concludes it is the host.
 */
export function isSimulationHost(awareness: Awareness, selfVisible: boolean): boolean {
  const self = awareness.clientID;
  const now = Date.now();
  const candidates: { clientId: number; visible: boolean }[] = [];

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === self) return;
    const lastUpdated = awareness.meta.get(clientId)?.lastUpdated ?? 0;
    if (now - lastUpdated > STALE_PEER_MS) return;

    // Only entries carrying a presence payload are real peers. The collab
    // server's own awareness client id, and peers mid-teardown, appear as states
    // with no `user` — and because they also carry no `visible` flag they used to
    // read as visible candidates and win the election, leaving the room with a
    // "host" that could not simulate anything.
    const user = state?.user as PresenceState | undefined;
    if (!user) return;

    candidates.push({ clientId, visible: user.visible !== false });
  });

  // Self is always a candidate, so a lone peer always simulates.
  candidates.push({ clientId: self, visible: selfVisible });

  const visible = candidates.filter((c) => c.visible);
  const pool = visible.length > 0 ? visible : candidates;
  let winner = pool[0];
  for (const candidate of pool) {
    if (candidate.clientId < winner.clientId) winner = candidate;
  }
  return winner.clientId === self;
}
