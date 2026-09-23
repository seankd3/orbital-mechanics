# ORBITAL — Design

> Fly Apollo 11 from Earth orbit to the Moon's surface and home again. The
> flight director tells you what comes next and why. You fly it, and every
> chapter grades how cleanly you did.

Decided with Sean (2026-09-23):

| Question | Answer |
| --- | --- |
| Structure | **Apollo campaign.** One continuous flight in nine short chapters. Each chapter can be restarted and is graded 0–3 ★. |
| Procedure depth | **Flight-director cues.** CAPCOM tells you the next step in plain words. The guidance computer solves each burn as an editable node, and you align and fire. No checklists or DSKY. |
| Hands | **Keyboard flies, mouse plans.** WASD/QE, throttle and warp are on the keyboard. In the map you drag the node along the orbit, and the camera works with the mouse. |
| Look | **Restrained clean vectors.** Crisp one-pixel lines on black and a mission-control palette. No bloom, scanlines or CRT shader. |

## Core loop (one chapter)

1. **Brief.** CAPCOM gives one line: what to do and why. *"Apollo, you're GO
   for TLI. Burn 3,180 prograde at the window."*
2. **Plan.** The computer's solution is shown as a node on the map, with the
   predicted trajectory drawn through to the Moon and a readout of what it
   achieves ("PERILUNE 110 KM"). You can drag the node to a different time,
   and the computer re-solves the burn for it.
3. **Fly.** Align with the navball cue (by hand, or `F` to hold it). Press `G`
   to warp to the ignition countdown, light the engine (`Z`), and cut off
   (`X`) when Δv-to-go reaches zero. Powered descent, ascent, docking and
   entry are flown by hand against a moving guidance cue. You get the
   automation Apollo's crew had: in P63/P64 the computer throttles and you
   fly the attitude. In P66 you own it: null the drift with the stick, and
   click the rate of descent with Shift/Ctrl while the computer holds it.
4. **Debrief.** Stars and the numbers behind them. The flight carries straight
   into the next chapter. `R` restarts the chapter at any time, so a mistake
   costs you seconds, not the whole mission.

**Stars.** ★ = objective met. ★★ = within tolerance. ★★★ = tight *and* hand-flown.
`B` hands a burn or a piloting phase to the computer (P40/P64/P12/P65); it
flies within tolerance, but can earn at most ★★.

## The nine chapters

| # | Chapter | You do | Graded on |
| - | --- | --- | --- |
| 1 | Trans-Lunar Injection | Learn attitude, map and warp, then fly the S-IVB burn | Predicted perilune vs 110 km |
| 2 | Midcourse Correction | Trim the coast, or skip it if your TLI was clean | Perilune at SOI entry |
| 3 | Lunar Orbit Insertion | Retro burn at perilune, behind the Moon | Orbit vs 110 km circular |
| 4 | Undock & DOI | LM separates and lowers perilune to 15 km | Perilune vs 15 km |
| 5 | Powered Descent | Follow the guidance cue down, land it | Touchdown class, fuel left |
| 6 | Lunar Ascent | Launch in the window and fly the ascent cue to orbit | Insertion orbit, timing |
| 7 | Rendezvous & Docking | TPI and braking burns, then RCS to contact | Contact speed, RCS used |
| 8 | Trans-Earth Injection | Burn for home, targeting the entry corridor | Predicted flight-path angle |
| 9 | Entry | Roll the lift vector through the corridor to splashdown | Peak g, no skip |

## Principles

- **The prediction is the outcome.** One patched-conic propagator is used for
  flight, trajectory drawing and targeting. Burns are predicted as finite burns
  with the ship's real engine and mass flow. If you follow the plan, you get
  exactly what the line showed.
- **The computer proposes; the player disposes.** Every assist is visible,
  interruptible, and uses the same propellant as manual flight.
- **One owner per phase.** A chapter owns the cue, the target and the grade,
  so there are no free-floating buttons.
- **Drama through restraint.** Quindar tones, sudden silence at cutoff and
  sparse callouts, not VFX.

## Kill-list (removed from v3)

- Bloom pass, CRT shader and CSS scanlines.
- Button panels: the hold/burn grids, node ±1/±10 buttons, UNDOCK/DOCK/STAGE/SWAP,
  and the CKPT EARTH/MOON teleports. Chapters handle staging, undock and dock,
  and `R` replaces the checkpoints.
- The Earth "training program" objective list (raise Ap 1,000 km, and so on).
- Naive TLI (a Hohmann to the Moon's *current* radius) and the fixed 900/1000
  m/s LOI/TEI buttons. All of these are replaced by real targeting.
- The 30° parking orbit that could never reach an equatorial Moon.
- The warp-dependent SOI handoff. Crossing events are now solved exactly,
  whatever the warp.
- Always-on help panel and manual craft-swap (`V`).
- Not ported, by decision: checklists, lessons, DSKY, the failure catalog,
  and telemetry replay. Their specs move to `docs/archive/`.

## Kept (harvested, with tests)

RK4 + drag integrator, orbital elements with the frame-free perifocal basis,
Kepler rails, kinematic Moon and SOI handoff, the stage-aware CSM/LM vehicles
(S-IVB → SPS; DPS → APS), Tsiolkovsky-metered finite burns, the HYG starfield,
Natural Earth coastlines, the canvas navball and the synthesized audio.
