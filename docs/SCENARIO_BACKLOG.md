# Scenario Backlog

This backlog turns the Apollo sim into a mission game: teach the controls, stage historically inspired missions, and add repeatable challenge scenarios with clear success, failure, and retry states.

## Scenario Framework Slices

1. Scenario manifest: id, title, vehicle, start state, objectives, limits, checkpoints, and unlock tags.
2. Objective engine: ordered and optional objectives with pass/fail predicates over orbit, body, vehicle mode, fuel, time, range, velocity, and landing state.
3. Scenario UI: compact checklist, active objective detail, success/failure banner, restart/checkpoint controls, and mission log causes.
4. Checkpoint loader: pad, parking orbit, translunar coast, lunar orbit, descent start, ascent start, rendezvous start, and entry interface.
5. Scoring layer: bronze/silver/gold bands for propellant used, timing error, landing accuracy, rendezvous closing speed, and entry corridor quality.
6. Training assists: scenario-scoped hints, ghost maneuver nodes, target markers, and optional auto-align/auto-burn gates.

**Acceptance criteria**

- A scenario can be started, failed, restarted, and completed without using developer shortcuts.
- Scenario state is data-driven enough that adding a new mission does not require custom UI code.
- Every failure names the actionable cause: missed SOI, unsafe periapsis, hard landing, no propellant, docking collision, steep entry, or skipped required step.
- Time warp stops before critical events: maneuver ignition, SOI transition, low-altitude hazard, closest approach, landing, docking, and entry interface.

## Tutorial Missions

**Goal:** teach one mechanic at a time before asking for a full Apollo profile.

**Slices**

- Orbit school: prograde/retrograde pointing, apoapsis/periapsis changes, circularization, fuel cost.
- Maneuver school: create node, align, burn at midpoint, compare predicted and actual orbit.
- Lunar transfer school: parking orbit to lunar SOI with one midcourse correction.
- Docking school: RCS translation, range/rate control, alignment cone, soft capture.
- Landing school: powered descent, vertical/horizontal speed limits, landing ellipse.
- Entry school: target periapsis corridor, coast to interface, hold attitude, survive heating/load checks.

**Acceptance criteria**

- Each lesson has one primary objective, one optional precision objective, and a short failure explanation.
- Player can complete all tutorials with assists enabled, then replay with assists disabled for higher score.
- Tutorial completion unlocks the matching historical or challenge scenario.

**Dependencies**

- Scenario framework, objective checklist, maneuver node execution, docking tolerance, landing classification, entry corridor model.

## Apollo 8

**Goal:** first crewed lunar-orbit mission without LM landing complexity.

**Slices**

- Start from Saturn V launch or Earth parking orbit checkpoint.
- Execute TLI, lunar SOI coast, midcourse correction, LOI, lunar orbit coast, TEI, and Earth entry.
- Add free-return guidance hints before LOI so the mission is playable even after a weak TLI.
- Score on TLI accuracy, LOI orbit quality, TEI return corridor, and remaining SPS delta-v.

**Acceptance criteria**

- Success requires stable lunar orbit and later Earth return with survivable entry corridor.
- Failure catches lunar impact, missed capture, escape after LOI, insufficient SPS for TEI, and unsafe Earth periapsis.
- The mission can be completed from the parking-orbit checkpoint in under 30 minutes of player time with time warp.

**Dependencies**

- Earth-Moon patched conics, SOI event stops, LOI/TEI maneuver nodes, entry challenge foundation.

## Apollo 11

**Goal:** full landing mission loop: go to the Moon, land, ascend, rendezvous, and return.

**Slices**

- Reuse Apollo 8 through low lunar orbit.
- Add LM activation, DOI/PDI setup, landing site target, powered descent, touchdown classification, and surface checkpoint.
- Add LM ascent, CSM target persistence, rendezvous phasing, docking, LM jettison, TEI, and entry.
- Score on landing accuracy, touchdown speed, DPS/APS/RCS margin, rendezvous safety, and return corridor.

**Acceptance criteria**

- Success requires landing inside the ellipse, safe touchdown rates, ascent to orbit, docking with CSM, and Earth return.
- Failure catches hard landing, landing outside mission bounds, CSM invalid orbit, failed ascent insertion, unsafe closing speed, and no return propellant.
- A player can restart from descent start, surface, ascent start, rendezvous start, or TEI without replaying the whole mission.

**Dependencies**

- Apollo 8 scenario, LM descent telemetry, lunar surface/landing model, inactive CSM state, rendezvous planner, docking capture.

## Apollo 13

**Goal:** crisis management scenario built around free-return survival and limited resources.

**Slices**

- Start after TLI with a scripted service-module failure that disables SPS and reduces power/consumable margins.
- Use LM as lifeboat: switch active vehicle constraints, preserve CSM for entry, and expose limited LM DPS burns.
- Add free-return correction, PC+2-style burn objective, Earth entry setup, and final CSM reactivation.
- Score on corridor accuracy, LM propellant remaining, time spent outside safe consumable bands, and course-correction count.

**Acceptance criteria**

- Success requires returning to Earth entry corridor without SPS and with consumables above minimum.
- Failure catches missed free-return, overcorrection, depleted LM propellant, invalid vehicle configuration, and unsafe entry angle.
- Mission text and objectives focus on decisions and constraints, not full spacecraft systems simulation.

**Dependencies**

- Entry challenge foundation, vehicle configuration guards, LM DPS maneuver support, resource-limit objective predicates, Apollo 8 return flow.

## Rescue / Rendezvous Challenge

**Goal:** a short, replayable orbital rescue built around phasing, relative motion, and docking discipline.

**Slices**

- Spawn player CSM and stranded target in nearby but mismatched Earth or lunar orbit.
- Provide range/range-rate, relative velocity vector, closest-approach prediction, and suggested phasing burns.
- Require approach corridor, stationkeeping hold, docking alignment, and safe capture.
- Variants: low fuel, high inclination mismatch, decaying target orbit, no auto-burn.

**Acceptance criteria**

- Success requires docking below closing-speed and alignment limits before time/fuel expires.
- Failure catches collision, excessive closing speed, target impact/escape, no RCS propellant, and missed rescue window.
- Challenge can be reset instantly with deterministic seeds for leaderboard-style replay.

**Dependencies**

- Separate target state vectors, rendezvous planner, RCS translation feedback, docking capture/failure, challenge scoring.

## Landing Challenge

**Goal:** make powered descent satisfying as a standalone skill test.

**Slices**

- Start at PDI or low hover gate with configurable landing site, initial perilune, fuel load, and terrain hazard radius.
- Show radar altitude, vertical speed, horizontal speed, site range, descent fuel, and touchdown prediction.
- Add variants: fuel squeeze, long downrange miss, boulder field ellipse, manual-only, night-side instruments-only.
- Score on landing accuracy, touchdown rates, fuel remaining, and time under high throttle.

**Acceptance criteria**

- Success requires touchdown inside the active landing zone with vertical and horizontal speed under limits.
- Failure catches impact, hard landing, tipover/slope violation, landing outside bounds, and fuel depletion.
- Player can replay from the same initial state in under ten seconds after failure.

**Dependencies**

- Lunar surface collision, landing classification, throttleable DPS, landing target marker, descent telemetry, restart checkpoint.

## Entry Challenge

**Goal:** turn the return corridor into a readable, high-stakes final exam.

**Slices**

- Start near Earth return with configurable velocity, flight-path angle, lift/drag simplification, and entry interface target.
- Show periapsis, predicted interface angle, heating/load bands, blackout timer, and splashdown ellipse.
- Add variants: shallow skip risk, steep overload risk, low RCS, manual attitude hold, late correction burn.
- Score on corridor centerline error, peak load, heat margin, splashdown accuracy, and remaining RCS.

**Acceptance criteria**

- Success requires staying inside the entry corridor and ending in a survivable splashdown state.
- Failure catches skip-out, burn-up/overload, ground impact, excessive attitude error, and missed correction opportunity.
- Entry predictions update after midcourse correction burns and degrade clearly when outside model confidence.

**Dependencies**

- Atmosphere/entry approximation, command module configuration, corridor predictor, event-stop time warp, splashdown classification.

## Suggested Build Order

1. Scenario framework and tutorials for orbit, maneuvers, and lunar transfer.
2. Apollo 8 as the first end-to-end historical mission.
3. Landing challenge and LM descent systems.
4. Rescue/rendezvous challenge and docking systems.
5. Apollo 11 using the landing and rendezvous pieces together.
6. Entry challenge, then wire it into Apollo 8 and Apollo 11 returns.
7. Apollo 13 once free-return, entry, vehicle guards, and resource predicates are stable.
