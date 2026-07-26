# Orbitboard — Collaborative Infinite Canvas

Real-time multiplayer infinite canvas with physics, presence radar, offline sync, multi-format export, and session time travel.

Built for the Abuja hackathon challenge.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **PixiJS** — WebGL infinite canvas (pan / zoom / culling / LOD)
- **Yjs** + **y-websocket** — CRDT real-time collaboration
- **y-indexeddb** — offline persistence + reconnect merge
- **Matter.js** — throw, collide, attract / repel
- **Zustand** — room state, with canvas objects held outside React
- Guest auth (username + color in `localStorage`)
- Package manager: **pnpm**

## Monorepo layout

```
apps/web            Next.js client
apps/collab-server  Yjs WebSocket server + media store
packages/shared     Shared types and object-model helpers
```

## Architecture notes

A few decisions are load-bearing and easy to undo by accident:

- **Objects are per-field CRDT maps.** Each canvas object is a `Y.Map` of
  individual fields with `props` as a nested `Y.Map` (`apps/web/src/lib/yjs/objects.ts`).
  Storing an object as one opaque value would make any concurrent edit
  last-write-wins across the whole object — one user dragging a sticky would
  discard another's text edit.
- **Media never enters the document.** Images and audio are uploaded to the
  collab server and referenced by URL; only the URL is collaborative. A local
  IndexedDB copy backs an offline fallback. Inline data URLs are used only when
  the upload cannot be made.
- **The op log is compacted, not truncated.** When history exceeds its limit the
  oldest ops are folded into a base snapshot before being dropped, so Time Travel
  still replays to a complete board rather than one missing its earliest objects.
- **React is not in the render loop.** Canvas objects live in a mutable map that
  the Pixi renderer reads directly; React state carries a throttled `revision`
  counter for the panels that display object data.
- **Simulation has a single owner.** The peer with the lowest awareness client id
  runs Matter.js and publishes positions at ~20Hz; every other peer interpolates
  toward them. The same peer owns op-log compaction.

## Quick start

Requires [pnpm](https://pnpm.io/installation) (v9+). With Corepack:

```bash
corepack enable
```

From the repo root:

```bash
pnpm install
```

```bash
pnpm dev
```

This starts:

- Web app → http://localhost:3000
- Collab server → ws://localhost:1234 (media over http on the same port)

Optional env (web):

```bash
# apps/web/.env.local
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
```

Optional env (collab server):

```bash
MEDIA_DIR=/var/lib/orbitboard/media   # default: os tmpdir
MAX_MEDIA_BYTES=8388608               # per-upload cap, default 8MB
PORT=1234
```

## Demo script (for judges)

1. Open http://localhost:3000, enter a username, **Create a room**.
2. Hit **Share** (top right) and open the link in a second browser / incognito
   window (a separate profile — guest identity is per-browser, so two tabs in the
   same browser count as the same user).
3. Pick a tool from the strip at the bottom, set colour / opacity / size in the
   panel on the right, and drop objects on the canvas — both cursors appear live.
4. Select something and **Enable physics** from the style panel, then switch to
   the **Physics** tool and fling it so it collides.
5. Watch the **Radar** for other users' viewports; drag it anywhere.
6. DevTools → Network → Offline, edit the canvas, go online again — changes sync via Yjs + IndexedDB.
7. **Menu → Spawn 2,000 shapes** a few times to load the canvas up, then pan and
   zoom with the bottom-left control.
8. **Menu → Export** for JSON / SVG / PNG, and **Menu → Time travel** to scrub or
   play back the session.

### Canvas UI layout

| Region | Contents |
|---|---|
| Top left | Room name and menu (exports, time travel, radar, theme, tour) |
| Top right | Collaborator avatars, connection state, Share |
| Right | Style panel — colour, opacity, size, corner radius, shape, text, physics (hidden under `md`) |
| Bottom centre | Edit actions (undo / redo / duplicate / delete / order) above the tool strip |
| Bottom left | Zoom out / reset / in |

Keyboard: `V` select · `H` hand · `D` draw · `S` shape · `T` text · `N` note ·
`I` image · `A` audio · `P` physics · `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo ·
`Ctrl/Cmd+D` duplicate · `Ctrl/Cmd+C/X/V` copy / cut / paste ·
`Ctrl/Cmd+A` select all · `Del` delete.

Direct manipulation: drag to move · corner and edge handles to resize · the round
grip above the selection to rotate (hold `Shift` to snap to 15°) · double-click
text, notes and shapes to edit their label.

## Using physics

Physics is opt-in per object. An object with physics off behaves like a normal
sticker; an object with physics on becomes a rigid body that collides with every
other physics body in the room.

**Turning it on**

1. Select one or more objects.
2. In the style panel (right), under **Physics**, press **Enable on selection**.
   The label flips to *Disable on selection* while the selection has bodies.

Nothing moves yet — the world starts with no gravity and no forces, so bodies sit
still until something acts on them. There are three ways to make them move:

| Action | How |
|---|---|
| **Throw** | Switch to the **Physics** tool (`P`), then drag an object and release. Release speed becomes launch velocity. |
| **Gravity** | Style panel → Physics → **Gravity**. Every body starts falling. |
| **Attract / repel** | Style panel → Physics → `attract` or `repel`. Bodies pull together or push apart continuously. |

**Things worth knowing**

- **You can still drag a physics object.** While your pointer is down, that body
  is pinned to your cursor and the simulation leaves it alone; it resumes when
  you let go. No need to disable physics first.
- **Gravity and attract/repel are room-wide**, not per object, and they are
  replicated — flipping gravity changes it for everyone.
- **One peer simulates.** The lowest awareness client id is elected host; it runs
  Matter.js and publishes positions ~20×/sec. Everyone else interpolates between
  those updates, so all peers see the same simulation instead of each computing
  their own and drifting apart.
- **Physics motion is not undoable and is not recorded in the op log.** It is
  derived state; recording a op per body per tick would swamp both.
- Bodies are approximated as rectangles regardless of the shape drawn.

## Understanding time travel

Time travel is a **read-only replay of the session's edit history**. It is not
undo, and it does not roll the room back.

Every edit — create, move, resize, restyle, delete, and each physics throw — is
appended to a shared op log. Opening **Menu → Time travel** gives you a slider
over that log:

- **Step 0** is the state of the board at the start of the recorded history.
- **Step N** is the board after the Nth operation.
- Dragging the slider, or pressing **Play**, renders that reconstructed state on
  the canvas *as an overlay*.

While the panel is open the live document is untouched, and collaborators see
nothing different — you are the only one viewing history. Closing the panel drops
the overlay and returns you to the present. There is currently no "restore this
state" action; to undo recent work use `Ctrl/Cmd+Z`.

Two details that explain what you see:

- The log is compacted once it grows past 4,000 operations: the oldest chunk is
  folded into a **base snapshot** that step 0 represents. So a long session
  replays from a complete board rather than from nothing, but the earliest
  individual steps are no longer separately scrubbable. The panel shows how many
  operations were compacted.
- Continuous physics motion is **not** in the log — only the throw that started
  it. Replaying a physics-heavy session shows objects jumping between recorded
  positions rather than gliding.

## Testing offline support

Offline support is real, not simulated, and you can exercise it entirely in dev.

```bash
pnpm dev
```

**The quickest check**

1. Open a room and add a few objects.
2. DevTools → **Network** tab → throttling dropdown → **Offline**.
3. The status pill top-right switches to offline, and a banner explains edits are
   being kept locally.
4. Keep working — add, move and delete objects. Everything stays responsive.
5. Set the throttle back to **No throttling**. The banner clears and your offline
   edits appear for other peers within a second.

**Proving it survives a reload**

1. Go offline as above and make a change.
2. Reload the page while still offline. Your objects are still there — they were
   restored from IndexedDB, not the server.
3. Go back online; the local document merges with the server's.

**Proving the merge is a real CRDT merge**

1. Open the same room in two separate browser profiles.
2. Take profile A offline.
3. Edit *the same object* from both — move it in A, recolour it in B.
4. Bring A back online. Both edits survive, because objects are stored field by
   field rather than as one blob.

**Inspecting the local store**: DevTools → Application → IndexedDB → `room-<id>`.
Deleting that database and reloading forces a clean re-sync from the server.

> Note: the app is offline-*tolerant*, not installable. There is no service
> worker, so a hard reload with the dev server stopped will not serve the app
> shell — the offline guarantee covers your board data, not the assets.

## Features checklist

| Requirement | Status |
|-------------|--------|
| Rooms + shareable link | Yes |
| Infinite canvas, pan/zoom | Yes (spatial index + culling + LOD) |
| Text, shapes, images, stickies, audio, freehand | Yes |
| Guest username auth | Yes |
| Responsive UI | Yes |
| Real-time collaboration | Yes (Yjs, per-field merge) |
| Physics (Matter.js) | Yes (single owner + client interpolation) |
| Minimap + radar | Yes |
| Offline → sync | Yes |
| Export PNG / SVG / JSON | Yes |
| Time travel replay | Yes (snapshot-backed op log) |
| Undo / redo | Yes (local-only, physics excluded) |
| Rotate objects | Yes (free, `Shift` snaps to 15°) |
| Text styling | Yes (size, bold, italic, alignment) |
| Error boundaries + 404 | Yes (route, room and global) |

Not implemented, and deliberately absent from the UI rather than shown as dead
controls: stroke dash and fill styles, an arrow/connector tool, align and
distribute, shape kinds beyond rectangle / ellipse / triangle, and text underline
(Pixi's text pipeline cannot render it, so it would work only in SVG export).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Web + collab server |
| `pnpm dev:web` | Web only |
| `pnpm dev:collab` | Collab server only |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint across the whole workspace |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm check` | Lint + typecheck |

Linting is type-aware and treats `react-hooks/exhaustive-deps`, unawaited
promises, and `set-state-in-effect` as errors — stale closures around the Yjs and
Pixi effects are silent correctness bugs, not style issues.

## Deploy notes

- Deploy `apps/web` to Vercel (set `NEXT_PUBLIC_COLLAB_URL` to your WS host).
- Deploy `apps/collab-server` to Railway / Fly / Render (expose `PORT`, default `1234`).
- Use `wss://` in production, and point `MEDIA_DIR` at a persistent volume —
  media on the default tmpdir does not survive a restart.
- Room documents are held in memory and released 60s after the last client
  leaves. Durable rooms would need server-side Yjs snapshot persistence.
