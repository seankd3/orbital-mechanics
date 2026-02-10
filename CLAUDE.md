# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive 3D orbital mechanics simulator built with vanilla JavaScript and Three.js. Players pilot an Apollo CSM-style spacecraft in realistic orbit around Earth with accurate Kepler equation physics.

## Development

No build system or package manager. Open `index.html` directly in a browser. Three.js v0.132.2 and its extensions are loaded from CDN (`cdn.jsdelivr.net`). No tests exist.

To serve locally for development:
```
python -m http.server 8000
```

## Architecture

All source is in `js/` with scripts loaded via `<script>` tags in `index.html` (order matters):

- **scaleManager.js** — Converts between real-world units (meters, m/s) and visualization units (1000:1 scale factor). Exposed as `window.scaleManager`.
- **planet.js** — `Planet` class. Earth with real mass (5.972×10²⁴ kg) and radius (6,371 km). IcosahedronGeometry with wireframe overlay.
- **spacecraft.js** — `Spacecraft` class. 6-DOF rotation + thrust controls, angular momentum, SAS (Stability Augmentation System), Apollo CSM visual model with thruster effects.
- **physics.js** — Pure function module. Gravitational force, Kepler equation solver (Newton-Raphson), orbital element calculations (all 6 elements), anomaly conversions, orbital propagation, collision detection.
- **scene.js** — `Scene` class (~1100 lines, largest file). Orchestrates rendering, animation loop, physics updates, camera, input handling, time warp (1x–1000x), trajectory visualization, and post-processing (UnrealBloomPass for CRT glow).
- **main.js** — Entry point. Creates all objects, initializes spacecraft in ISS-like 400km orbit, starts animation loop.

## Physics Modes

The simulator switches between two physics computation modes automatically:

- **Keplerian (on-rails)**: Analytic propagation via Kepler's equation. Used at time warp >1x when not thrusting. Fast and accurate for unperturbed orbits.
- **Newtonian (numerical)**: Gravitational force integration each frame. Used when thrusting or at 1x time warp. Supports up to 10 substeps per frame for accuracy during high time warp.

## Controls

Keyboard: W/S pitch, A/D yaw, Q/E roll, SPACE thrust, T toggle SAS, comma/period time warp, R reset camera. Mouse: left-drag orbit camera, scroll zoom.

## Style

The UI uses a CRT vector display aesthetic — green monospace text on black, wireframe 3D models, bloom post-processing glow.
