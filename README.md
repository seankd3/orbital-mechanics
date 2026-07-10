# ORBITAL — Vector Flight Console

A retro CRT vector-display orbital mechanics game. Fly the full Apollo stack on
real patched-conic physics: burn TLI on the S-IVB, capture into lunar orbit,
undock the LM, fly a powered descent to a surface touchdown, stage, ride the APS
back up, rendezvous and dock with the CSM, and burn for home — or just run the
Earth-orbit training program. All over a coastline vector Earth and the real HYG
night sky.

Keys for the lunar arc: **V** swaps CSM ↔ LM when separated; the Vehicle panel
has UNDOCK / DOCK / STAGE. Docking needs <300 m and <3 m/s closing.

## Run

```sh
npm install
npm run dev     # http://localhost:5175
```

## Controls

| Key | Action |
| --- | --- |
| W/S, A/D, Q/E | Pitch / yaw / roll |
| I/K, J/L, U/O | RCS translate |
| SPACE | Fire engine |
| SHIFT / CTRL | Throttle up / down (Z max, X cut) |
| T | SAS — kill rotation |
| N / B | Create maneuver node / execute burn |
| [ ] / { } | Node ΔV / node TIG |
| M | Map view (orthographic, down the orbit normal) |
| , / . | Time warp down / up (to 100,000×) |
| R | Reset flight |
| H | Toggle help |
| Mouse | Orbit camera, wheel zoom |

The Orbit Ops panel offers Apollo-style assists: attitude holds
(PRO/RETRO/RAD±/NRM±), solved TLI/CIRC burns, fixed LOI/TEI, and Earth/Moon
orbit checkpoints.

## How it works

- **`src/sim/`** — the model, in SI units: patched-conic primaries (Earth + kinematic
  Moon with SOI handoff), RK4 integration with thrust/RCS/drag, exact Kepler on-rails
  propagation at high warp, a single-node maneuver planner with finite
  Tsiolkovsky-metered burns, Apollo orbit-ops assists, mission objectives.
- **`src/render/`** — the view: coastline + graticule vector Earth, crater-ringed Moon,
  HYG catalog starfield, edged wireframe CSM, orbit/predicted-orbit lines, and a
  bloom + CRT shader pass with an orthographic MAP camera.
- **`src/ui/`** — DOM HUD panels, node editor, navball (2D canvas), synthesized audio,
  notifications, formatting.

Simulation state lives in meters relative to the current primary; rendering scales
by `RENDER_SCALE` (1e-6) in an Earth-centered frame.
