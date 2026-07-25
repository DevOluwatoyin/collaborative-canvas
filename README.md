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
| Right | Style panel — colour, opacity, size, shape, physics (hidden under `md`) |
| Bottom centre | Edit actions (undo / redo / duplicate / delete / order) above the tool strip |
| Bottom left | Zoom out / reset / in |

Keyboard: `V` select · `H` hand · `D` draw · `S` shape · `T` text · `N` note ·
`I` image · `A` audio · `P` physics · `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo ·
`Ctrl/Cmd+D` duplicate · `Ctrl/Cmd+A` select all · `Del` delete.

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

Not implemented, and deliberately absent from the UI rather than shown as dead
controls: stroke dash and fill styles, an arrow/connector tool, align and
distribute, and shape kinds beyond rectangle / ellipse / triangle.

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
