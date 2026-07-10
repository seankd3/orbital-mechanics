# CLAUDE.md

## Project Overview

ORBITAL — a retro CRT vector-display orbital mechanics game (Three.js + TypeScript).
Apollo-style CSM on patched-conic physics: Earth training missions, maneuver nodes,
TLI to a kinematic Moon with SOI handoff, orbit-ops assists.

v3.0 (2026-07-09) merged two lineages: the Apollo feature build (vanilla JS, in git
history before the merge commit) and the v2 Vite + TypeScript rebuild. The Apollo
build's dormant data modules (checklists, lessons, failures, profiles, rendezvous
planner, entry guidance) are NOT yet ported — retrieve them from history at
`773ebbd:js/apollo*.js`; their design specs live in `docs/`.

## Development

```sh
npm install
npm run dev     # Vite, http://localhost:5175
npm run build   # tsc + vite build
```

## Architecture

Simulation state is SI meters **relative to the current primary** (Earth or Moon);
rendering scales by `RENDER_SCALE` (1e-6) in an Earth-centered frame.

- `src/constants.ts` — bodies, ship, atmosphere, warp tables
- `src/sim/` — physics (RK4 + Kepler + drag), simulation (patched conics, SOI,
  rails at high warp), spacecraft (attitude, SPS, RCS), maneuver (node planner,
  finite auto-aligned burns), apollo (holds, TLI/CIRC/LOI/TEI assists, orbit
  guards), missions, bodies
- `src/render/` — stage (composer + bloom + CRT pass + map ortho camera), planet
  (graticule + Natural Earth coastlines), moon, ship, orbitLine, starfield (HYG)
- `src/ui/` — hud, navball (2D canvas), audio (synthesized), notify, format
- `public/data/` — `star_catalog.json` (HYG), `ne_50m_coastline.json`

Conventions: ship body frame is +Z forward; world is Y-up; orbital elements are
reconstructed frame-free from stored perifocal basis vectors (`eHat`/`qHat`).

In dev, `window.__game` exposes `{sim, missions, update, resetCamera, controls,
setMapMode}` so tests can drive the loop when rAF is throttled (occluded windows).

## Style

Green-phosphor CRT vector aesthetic: monospace uppercase HUD, wireframe/edged
geometry, subtle bloom + scanlines. Keep modules small; no monoliths.
