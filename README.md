# ORBITAL — Apollo 11

Fly the first lunar landing, from Earth parking orbit to the Sea of
Tranquility and home to the Pacific, on a clean vector display. Houston
tells you what comes next and why, and you fly it. Each of the nine chapters
is graded, and ★★★ takes a clean, hand-flown job.

The physics is real enough to be honest:

- Patched-conic Earth and Moon.
- Finite burns with actual mass flow.
- An E-guidance powered descent.
- Lambert rendezvous.
- A lifting-entry capsule.

The line the map draws is the path you will fly, to within centimeters.

## Play

```sh
npm install
npm run dev     # http://localhost:5175
```

Pick a chapter and press **Enter**. Chapters run in order, and each starts
where your last one ended. `R` restarts a chapter at any time, and the menu
can start any chapter you've reached from the nominal flight.

| Key | |
| --- | --- |
| W/S · A/D · Q/E | Pitch · yaw · roll |
| F | Hold attitude on the ◇ guidance cue |
| Z / X | Throttle full / cut off |
| Shift / Ctrl | Throttle up / down (feather a cutoff); in P66, slow / speed the descent |
| I/K · J/L · U/O | RCS translation (docking) |
| G | Warp to the next event (ignition, SOI, PDI, entry…) |
| , / . | Time warp down / up (10× max under power) |
| B | Hand the phase to the computer (caps the chapter at ★★) |
| Enter | Accept a short burn · continue |
| M · Tab | Map view · map focus |
| Drag ◇ | In the map, move the burn; the computer re-solves it |
| Backspace | Restore the computer's burn |
| R · Esc · H | Restart chapter · menu · keys |

**The chapters:**

1. Trans-Lunar Injection
2. Midcourse Correction
3. Lunar Orbit Insertion
4. Undock & DOI
5. Powered Descent
6. Lunar Ascent
7. Rendezvous & Docking
8. Trans-Earth Injection
9. Entry & Splashdown

See [`DESIGN.md`](DESIGN.md) for the loop, the grading and what was
deliberately left out.

## How it works

- **`src/sim/`** is the model, in SI units, with no DOM or three.js scene code.
  - `orbit` holds exact conics (ellipse and hyperbola) with radius and
    apsis timing.
  - `coast` is the one patched-conic propagator. It solves SOI, atmosphere
    and surface crossings exactly, so warp never changes the outcome.
  - `simulation` runs RK4 only under thrust or in air, rests the LM on a
    rotating Moon, and flies the CM with lift and chutes.
  - `burn` and `executor` handle finite, fixed-attitude burns centred on TIG,
    with a vector Δv-to-go meter.
  - `targeting` solves TLI, MCC, LOI, DOI and TEI to the entry corridor,
    plus Lambert TPI and braking.
  - `guidance` covers descent (P63/P64/P66), ascent (P12), entry bank and
    docking.
- **`src/game/`** is the campaign. A `Chapter` is a list of phases: a
  computer-solved burn, a hand-flown pilot phase, or a coast. The `Director`
  runs one chapter and grades it. `nominal` flies each chapter on AUTO to
  produce the next chapter's start state.
- **`src/render/`** holds the true-scale chase camera and the top-down map,
  the vector Earth (Natural Earth coastlines) and Moon, a local surface
  patch for low flight, the craft, and the HYG starfield.
- **`src/ui/`** has the CAPCOM line, the instrument strip, the
  flight-director navball, context cards, map labels and node drag, the
  menu and debrief screens, and synthesized audio.

## Develop

```sh
npm run check   # tsc + vitest (physics, targeting, guidance, the full mission, pilot paths)
npm run build   # production build; relative base so it runs from any subpath
```

`src/game/mission.test.ts` flies the whole Apollo 11 arc on AUTO, chapter
by chapter, and checks every grade. In dev, `window.__game` exposes the sim,
the director and `advance(steps)` for scripted flights.
`scripts/fly-mission.mjs` uses it to fly the mission in a real browser and
screenshot every chapter.
