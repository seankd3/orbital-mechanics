# Control Map

Operator-facing control reference for the current Apollo orbital sandbox, with proposed next controls called out where they are not live yet.

Status labels:

- **Current**: implemented in the running UI.
- **Partial**: usable, but represented as a simplified state change or fixed assist.
- **Proposed**: intended control behavior, not yet implemented as an operator feature.

## KSP-Player Quickstart

1. Press `ORBIT` for the fast KSP-like start: a CSM+LM stack in low Earth parking orbit with map view enabled.
2. Press `M` to stay in map view, scroll to zoom, and watch `AP`, `PE`, `TTA`, `TTP`, `TLI DV`, and `CIRC` in the Apollo mission panel.
3. Create a node with `N` or `CREATE`, add prograde with `]` or the `PRO +/++` buttons, then use `ALIGN` and `BURN` to fly it.
4. For a scripted lunar sequence, use `TLI`, coast toward the Moon with `.` time warp, then use `LOI`, `LM`, `PDI`, `ASC`, `CSM`, and `TEI`.
5. Treat the mission buttons like MechJeb assists: they spend propellant, can leave you in a bad orbit, and `OFF` cancels active guidance.

## Camera And Map

**Current**

- Mouse drag on the 3D canvas: orbit the chase camera.
- Mouse wheel: zoom the chase camera; in map view, zoom the orthographic map.
- `C`: toggle craft-locked chase camera and orbit-frame chase camera.
- `M`: toggle map view and craft camera.
- `R`: reset chase-camera orbit angles.
- `1`: toggle orbit/predicted-trajectory display.
- `2`: toggle Earth grid.
- `3`: toggle coastlines.
- `4`: toggle stars.
- `.` / `,`: increase/decrease time warp. Apollo mode exposes `1x`, `2x`, `5x`, `10x`, `50x`, `100x`, `1000x`, `5000x`, and `10000x`; lunar SOI and maneuver burns force lower warp when needed.

**Proposed**

- Map pan with mouse drag, instead of only camera orbit state.
- Clickable AP/PE/body/event markers.
- Warp-stop guards before SOI changes, periapsis, maneuver ignition, low-altitude hazards, impact, and mission-critical events.

## Attitude And Main Engine

**Current**

- `W` / `S`: pitch.
- `A` / `D`: yaw.
- `Q` / `E`: roll.
- `Space`: hold main engine thrust for the active vehicle or stage.
- `T`: toggle SAS rate damping.
- Navball: shows attitude references including prograde, retrograde, normal, radial, horizon, and maneuver-vector context when a node exists.
- Bottom HUD: `SAS`, `THR`, `FUL`, `DV`, `RCS`, and `RTE` show assist, thrust, fuel, remaining delta-v, RCS propellant, and angular rate.

**Current assist holds**

- Apollo panel `PRO`, `RET`, `RAD`, `RIN`, `NRM`, and `AN`: hold prograde, retrograde, radial out, radial in, normal, or anti-normal.
- Hold commands enable SAS and slew the vehicle to the selected vector.

**Proposed**

- Surface-relative holds, especially surface retrograde for landing.
- Attitude mode annunciators on the navball/DSKY that clearly distinguish manual SAS from vector holds.
- Manual controls should cleanly cancel incompatible auto-holds when the pilot takes over.

## RCS Translation

**Current**

- `I` / `K`: translate forward/backward in the spacecraft local frame.
- `J` / `L`: translate left/right.
- `U` / `O`: translate up/down.
- RCS uses a separate propellant pool and low thrust, so it is for trimming, stationkeeping, and future docking work, not major orbit changes.

**Proposed**

- A visible RCS mode/state annunciator and individual jet feedback.
- Docking/proximity readouts: range, range rate, line-of-sight rate, alignment cone, and capture tolerance.
- Translation axes mapped to a docking reticle so KSP-style close approach corrections are easier to read.

## Maneuver Nodes

**Current**

- `N`: create or clear a maneuver node.
- Click the rendered orbit line: place the node at that point.
- `[` / `]`: adjust prograde delta-v by `-10` / `+10` m/s.
- `{` / `}`: adjust time of ignition by `-60` / `+60` seconds.
- `V` or `ALIGN`: toggle auto-align to the maneuver vector.
- `B` or `BURN`: execute the maneuver burn.
- Node editor buttons:
  - `CREATE`: create a node, defaulting to `+10 m/s` prograde if empty.
  - `NOW`, `AP`, `PE`: place the node at now, apoapsis, or periapsis.
  - `PRO`, `NRM`, `RAD` `--`, `-`, `+`, `++`: edit prograde, normal, and radial delta-v by `10` or `100` m/s steps.
  - `TIG -5M/-1M/+1M/+5M`: adjust node time.
  - `ZERO`: zero the node vector.
  - `CLEAR`: remove the node.
- Node readouts: total delta-v, TIG, predicted AP/PE, ignition lead, alignment error, and burn duration.
- `BURN` arms a future node, auto-aligns, ignites at roughly `TIG - burnDuration / 2`, drops warp to `1x` for the burn, uses main-engine propellant, then clears the node. If already inside the ignition window, it starts immediately.

**Proposed**

- Drag handles for prograde/retrograde, normal/anti-normal, and radial in/out.
- Multiple maneuver nodes and downstream predicted paths.
- Burn midpoint timing as a first-class countdown: ignite at `TIG - burnDuration / 2`.
- Node generation from mission buttons, replacing fixed TLI/LOI/PDI/TEI burns with editable maneuver plans.

## Apollo Mission Panel

**Current**

- Mission telemetry: `PHASE`, `MET`, active body, active vehicle, guidance state, AP/PE, time to AP/PE, estimated `TLI DV`, circularization delta-v, Moon range, and recent log lines.
- `LAUNCH`: reset to Saturn V if needed and start simplified ascent guidance from the Cape.
- `ORBIT`: shortcut to a 185 km Earth parking orbit in CSM+LM mode.
- `TLI`: run a prograde lunar-transfer estimate from the current Earth orbit.
- `CIRC`: circularize around the active primary body.
- `LOI`: fixed `900 m/s` retrograde burn.
- `PDI`: fixed `420 m/s` retrograde burn in LM descent context.
- `TEI`: fixed `1000 m/s` prograde burn.
- `OFF`: clear active guidance and stop mission-owned thrust.

**Partial**

- Mission commands are useful operator shortcuts, but most are not phase-guarded yet. They can create impossible or non-Apollo states if pressed out of sequence.
- The Moon, SOI switch, and primary-body telemetry are live, but transfers are patched-conic gameplay scaffolding, not validated Apollo guidance.

**Proposed**

- Mission phase guards and warnings before invalid commands.
- Checklist/objective state so the panel says what condition is good enough before the next phase.
- Failure/restart controls for pad, parking orbit, lunar orbit, and major checkpoints.

## MechJeb-Like Assists

**Current**

- Launch guidance: pitches from radial toward east, burns continuously, and auto-stages when a Saturn V stage is empty.
- Attitude holds: prograde, retrograde, radial in/out, normal, anti-normal.
- Fixed mission burns: TLI estimate, circularize estimate, LOI, PDI, and TEI.
- Maneuver node assist: auto-align and node burn execution using the same propellant path as manual thrust.

**Proposed**

- Lunar transfer assistant that suggests window, node timing, and prograde delta-v without hiding the node details.
- LOI/TEI assistant that proposes perilune/perilune-time burns from the current conic.
- Descent assistant with vertical-speed limiting, landing prediction, and surface retrograde hold.
- Rendezvous assistant showing closest approach, relative velocity, phase angle, and correction-burn suggestions.
- Assist ownership rules so mission burns, node burns, manual thrust, and attitude holds cannot fight for the same controls.

## Staging

**Current**

- `STAGE`: manually separate the current Saturn V stage.
- Launch guidance also stages automatically when the active stage propellant is depleted.
- Saturn V stages progress S-IC -> S-II -> S-IVB -> CSM+LM.
- Once the active vehicle is no longer Saturn V, `STAGE` logs `NO STAGE`.

**Proposed**

- Stage confirmation and mission phase validation.
- Staging transients, coast periods, S-IVB restart handling, and clearer post-stage vehicle state.
- Abort/reset states for launch and ascent failures.

## LM And CSM Operations

**Current**

- `DOCK`: set the active vehicle to docked CSM+LM and log the docked state.
- `LM`: switch to LM descent vehicle mode.
- `PDI`: run the current fixed powered-descent-initiation retrograde burn.
- `ASC`: switch to LM ascent vehicle mode.
- `CSM`: switch back to CSM vehicle mode.
- `TEI`: run the current fixed trans-Earth injection burn from CSM context.

**Partial**

- Vehicle switches change mass, thrust, propellant, model, and label, but do not yet maintain separate active/inactive CSM and LM state vectors.
- Docking is currently a state change, not a proximity-operations simulation.
- LM descent is not yet a landing simulation: no terrain, touchdown classification, hover/abort logic, or landing-site targeting.

**Proposed**

- Separate CSM and LM vessels during undocking, descent, ascent, rendezvous, and docking.
- Stored CSM target orbit for LM ascent guidance.
- RCS-based docking with range/rate, alignment, soft capture, hard capture, and collision handling.
- LM descent telemetry: radar altitude, vertical speed, horizontal speed, throttle, landing-site range, and abort margin.
