# CLAUDE.md

## Project Overview

ORBITAL is an Apollo 11 flight game (Three.js + TypeScript, Vite). It is a
nine-chapter campaign (TLI → MCC → LOI → DOI → powered descent → ascent →
rendezvous → TEI → entry) with flight-director cues: CAPCOM says what is
next, the computer solves each burn as an editable node, and the player flies
it. Chapters are graded 0–3 ★. [`DESIGN.md`](DESIGN.md) is the product spec,
with Sean's decisions and the kill-list. The pre-v4 specs in `docs/archive/`
are reference only.

## Development

```sh
npm install
npm run dev     # Vite, http://localhost:5175
npm run check   # tsc --noEmit + vitest (includes the full-mission flight)
npm run build   # tsc + vite build (base './' for subpath hosting)
```

Hosted at seankennethdoherty.com/play/orbital-mechanics/. Never deploy or
republish without Sean's explicit approval.

## Architecture

The simulation uses SI meters **relative to the current primary** (Earth or
Moon). Rendering is Earth-centered at `RENDER_SCALE` (1e-6). Craft models are
true scale. Float64 object transforms keep them precise, and track vertices
stay primary-relative.

- `src/sim/` is pure model with no DOM.
  - `orbit.ts` is an immutable conic (elliptic or hyperbolic).
  - `coast.ts` is the single patched-conic propagator with exact events.
  - `simulation.ts` holds the CSM and LM. Coasting always rides the conic;
    RK4 runs only under thrust or in air.
  - `burn.ts` / `executor.ts` handle finite burns and the P40 executor.
  - `targeting.ts` holds the mission solvers; `lambert.ts` solves Lambert's
    problem.
  - `guidance.ts` holds the descent (P63, P64 to a landing site, P66),
    ascent, entry and docking laws.
  - `terrain.ts` is the boulder field at the landing site; a hazard under
    a footpad tips the LM over at contact.
  - `vehicles.ts` has stage data; `spacecraft.ts` is one craft.
- `src/game/` is the campaign.
  - `chapter.ts` holds the types.
  - `chapters/` holds the nine chapter definitions. `descent.ts` carries
    the landing drama: program alarms, high gate, the LPD, fuel calls.
  - `director.ts` runs a chapter's phases, AUTO, warp targets and grading.
  - `nominal.ts` builds the launch state and the AUTO chain of chapter
    starts.
  - `campaign.ts` holds progress in localStorage.
- `src/render/` holds `stage`, `camera` (horizon-frame chase; auto-framed
  map), `world` (per-frame placement), `trajectory`, `surface` (the
  low-altitude patch), `boulders` (the field and the LPD reticle), `ship`,
  `planet`, `moon`, `starfield` and `labels`.
  - `lines` is the only way to draw a line: analytically anti-aliased
    screen-space strokes. Widths are in CSS px, coverage is applied in
    linear light, and strokes combine by MAX. `LineBuffer` handles lines
    rewritten every frame without reallocating. Dense repeating detail
    (grids, craters, graticules) uses `fade: true` with a feature size
    per segment, so it fades out before it can shimmer below a few pixels.
    Stars are drawn the same way, as covered discs (`starfield`).
  - `depth` makes the log depth buffer work in meters, so edges resolve
    against the faces behind them at craft range.
- `src/ui/` holds `hud`, `navball`, `mapview` (labels and node drag),
  `overlay` (menu, debrief, abort), `audio` and `format`.
- `public/data/` holds `star_catalog.json` (HYG) and `ne_50m_coastline.json`.

Conventions:

- Craft +Z is the thrust axis (the LM's +Z is up), and the world is Y-up.
- Everything is equatorial and coplanar. Lunar orbits are clockwise, like
  Apollo's.
- Tests live next to the code (`*.test.ts`). Physics changes need a test
  showing that the prediction matches the flown result.

In dev, `window.__game` exposes `{sim, director, mode, rig, campaign, nominal,
start(i), command(cmd), update(dt), advance(steps, dt)}`. `advance` flies
without drawing each frame, which is useful when rAF is throttled or
rendering in software GL. `scripts/fly-mission.mjs` flies the whole mission
through it and saves screenshots.

## Style

Restrained clean vectors, like a mission-control display: thin, smooth
anti-aliased strokes (1–1.5 px) on near-black, and color only where it means something (green nominal track,
amber plan and cue, cyan target, red warning). No bloom, scanlines or CRT
shader. The HUD is monospace, uppercase, with tabular numerals. Keep modules
small and single-purpose.
