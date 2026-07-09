# ORBITAL — Vector Flight Console

A retro CRT vector-display orbital mechanics game. Fly an Apollo-style CSM from a
400 km parking orbit through a four-objective mission — raise apoapsis, circularize,
deorbit, and survive reentry to splashdown — on real two-body physics.

## Run

```sh
npm install
npm run dev     # http://localhost:5175
```

## Controls

| Key | Action |
| --- | --- |
| W/S, A/D, Q/E | Pitch / yaw / roll |
| SPACE | Fire engine |
| SHIFT / CTRL | Throttle up / down (Z max, X cut) |
| T | SAS — kill rotation |
| , / . | Time warp down / up (to 100,000×) |
| R | Reset flight |
| H | Toggle help |
| Mouse | Orbit camera, wheel zoom |

## How it works

- **`src/sim/`** — the model, in SI units: RK4 integration with thrust + exponential-atmosphere
  drag; analytic orbital elements; exact Kepler (on-rails) propagation at high time warp;
  fuel/Δv via Tsiolkovsky; sequential mission objectives.
- **`src/render/`** — the view: phosphor-graticule Earth, edged wireframe CSM, orbit
  prediction line with Pe/Ap markers, starfield, and a bloom + CRT shader pass.
- **`src/ui/`** — DOM HUD panels, notifications, formatting.

Simulation state lives in meters; rendering scales by `RENDER_SCALE` (1e-6).
