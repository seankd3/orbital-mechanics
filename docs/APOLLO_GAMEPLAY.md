# Apollo Gameplay Design

This document describes the practical gameplay target for the current Apollo sim. It should guide implementation toward a KSP/MechJeb-like mission experience without turning the project into a full spacecraft systems simulator.

## Core Player Loop

1. Read the current mission state: phase, vehicle, body, orbit, propellant, attitude, maneuver node, and range to the Moon.
2. Pick the next mission objective: parking orbit, TLI, docking, LOI, LM descent, ascent, rendezvous, TEI, or optional launch/ascent testing.
3. Plan the action using the map view, maneuver node editor, navball, and mission assist buttons.
4. Execute with either manual controls or an assist mode.
5. Verify the result against telemetry and predicted orbit.
6. Correct errors with small burns, RCS translation, or a new node.
7. Spend or save propellant under real consequences.

The desired feel is "flight director with hands on the controls": assists can perform routine pointing and burns, but the player must understand the plan, timing, resource cost, and failure modes.

## Mission Phases

Orbit-first play is the default for the current Apollo/KSP slice: the sim now boots into stable Earth parking orbit, `Earth` resets that checkpoint, and `Moon` jumps to a low lunar orbit for LOI/LM/TEI iteration. The simplified Saturn V launch path can return later for ascent tuning, but it should not block players from the orbital mission loop.

### 1. Prelaunch

- Vehicle: Saturn V on the pad at Cape Canaveral.
- Player intent: optional ascent test or reset point, not the primary start for orbital play.
- Current implementation: `LAUNCH` resets to Saturn V if needed and starts ascent guidance.
- Needed gameplay: countdown state, launch commit/cancel, basic abort/reset path.

### 2. Saturn V Launch and Ascent

- Vehicle: Saturn V S-IC, S-II, then S-IVB.
- Player intent: ride or manually manage ascent to a usable parking orbit.
- Current implementation: launch guidance pitches from radial to eastward, burns continuously, and auto-stages when active stage propellant is depleted. `STAGE` also works manually.
- Target outcome: roughly 185 km parking orbit with stable periapsis above atmosphere.
- Failure states: ground impact, bad pitch program, premature staging, spent stage with suborbital trajectory, excessive time warp disabled during critical ascent.

### 3. Earth Parking Orbit

- Vehicle: CSM+LM/S-IVB mission stack abstracted as CSM+LM after staging.
- Player intent: stabilize orbit, inspect node tools, plan TLI.
- Current implementation: the default boot state and `Earth` seed a 185 km Earth parking orbit in CSM+LM mode.
- Needed gameplay: make this a legitimate ascent result, not only a shortcut; show parking-orbit checklist status.

### 4. Trans-Lunar Injection

- Vehicle: CSM+LM using the main engine abstraction.
- Player intent: burn prograde at the right time to intercept the Moon.
- Current implementation: mission `TLI` runs a fixed 3150 m/s prograde burn; node editor can create, align, and execute arbitrary burn vectors.
- Target outcome: predicted lunar SOI entry with enough CSM propellant for LOI, corrections, and TEI.
- Failure states: missed lunar SOI, Earth escape with no return plan, underburn and reentry, overburn with insufficient return propellant.

### 5. Transposition and Docking

- Vehicle: CSM and LM represented as combined CSM+LM after docking.
- Player intent: separate, turn around, dock with LM, continue coast.
- Current implementation: `DOCK` swaps into CSM+LM and logs docked state.
- Needed gameplay: relative target, RCS translation objective, docking tolerance, collision/range/rate feedback.
- Keep this phase lightweight at first: a guided docking box is enough before full rendezvous physics.

### 6. Translunar Coast and Midcourse Correction

- Vehicle: CSM+LM.
- Player intent: time warp toward lunar SOI, monitor range, perform small correction nodes.
- Current implementation: Moon exists, moves on a circular orbit, and SOI switches primary body near the Moon.
- Target outcome: enter lunar SOI on a trajectory suitable for LOI.
- Failure states: lunar impact before LOI, flyby with no capture, time warp through an important event, insufficient correction propellant.

### 7. Lunar Orbit Insertion

- Vehicle: CSM+LM.
- Player intent: burn retrograde near perilune to capture into lunar orbit.
- Current implementation: mission `LOI` runs a fixed 900 m/s retrograde burn.
- Target outcome: stable low lunar orbit with clear perilune/apolune telemetry.
- Failure states: failed capture, lunar impact, highly eccentric orbit outside LM descent constraints, low propellant margin.

### 8. LM Activation and Descent

- Vehicle: LM descent stage.
- Player intent: switch to LM, begin powered descent, manage horizontal velocity and landing rate.
- Current implementation: `LM` switches to LM descent mode; `PDI` runs a fixed 420 m/s retrograde burn.
- Target outcome: touchdown inside a landing ellipse with low vertical and horizontal velocity.
- Needed gameplay: lunar surface collision/landing classification, altitude/radar readout, throttleable DPS, descent guidance marker, landing site target.
- Failure states: hard landing, tipover/slope violation, out of DPS propellant, excessive lateral speed, CSM left in invalid orbit.

### 9. LM Ascent and Rendezvous

- Vehicle: LM ascent stage.
- Player intent: launch from the Moon, circularize, rendezvous with CSM.
- Current implementation: `ASC` switches to LM ascent mode.
- Target outcome: LM ascent returns to the CSM with a dockable relative state.
- Needed gameplay: stored CSM target orbit, ascent guidance, rendezvous phasing, docking tolerance reused from transposition.
- Failure states: failed orbit, missed CSM plane/phase, out of APS/RCS propellant, collision at unsafe closing speed.

### 10. Trans-Earth Injection

- Vehicle: CSM.
- Player intent: jettison LM/ascent stage, burn prograde from lunar orbit toward Earth return.
- Current implementation: `CSM` switches back to CSM; mission `TEI` runs a fixed 1000 m/s prograde burn.
- Target outcome: Earth-return trajectory with survivable entry corridor later.
- Failure states: failed Earth return, lunar escape to deep space, Earth impact/reentry too steep, not enough propellant for correction.

## MechJeb-Like Assist Modes

Assists should be explicit, visible, interruptible, and fuel-accounted. They should use the same physics and propellant as manual flight.

- Attitude hold: prograde, retrograde, radial in/out, normal/anti-normal, maneuver vector, surface retrograde for landing.
- Node planner: create node, place at now/AP/PE/clicked orbit point, edit prograde/normal/radial delta-v, show predicted AP/PE, burn duration, ignition time, and alignment error.
- Auto-align: slew to selected hold vector or maneuver vector; leave SAS on.
- Auto-burn: start at half burn duration before TIG, cut off at target delta-v, drop to 1x warp before ignition.
- Launch guidance: pitch program, stage when empty, target parking orbit apoapsis/periapsis.
- Lunar transfer assistant: suggest TLI window and approximate prograde delta-v; still expose node details.
- LOI/TEI assistant: propose perilune/perilune-time burn based on current conic.
- Descent assistant: hold descent attitude, limit vertical speed, display landing prediction; do not guarantee landing without propellant and player confirmation.
- Rendezvous assistant: show closest approach, relative velocity, phase angle, and suggested correction burns.

Assist state should be shown in the mission panel/log and in the maneuver/DSKY UI. Any manual thrust, stage, or OFF command should cancel incompatible assists cleanly.

## Failure States

Failure should teach the player what went wrong and leave a useful post-failure state or restart option.

- Impact: Earth or Moon collision above survivable speed.
- Bad landing: touchdown vertical/horizontal speed or slope exceeds limit.
- Propellant depletion: SPS/DPS/APS/RCS pool reaches zero while needed for active objective.
- Missed trajectory: no lunar SOI after TLI, no lunar capture after LOI attempt, no Earth return after TEI.
- Unsafe orbit: periapsis intersects body/atmosphere, lunar orbit too low, eccentricity escapes current body when capture was required.
- Docking failure: closing speed or angle exceeds tolerance.
- Stage/configuration error: trying LOI in LM-only mode, PDI without lunar orbit, TEI before returning to CSM.
- Guidance fault: assist cannot compute a valid vector, node is stale, or primary body switches during an armed burn.

Use clear cause labels in the mission log, for example `FAIL: LUNAR IMPACT`, `WARN: PE BELOW SURFACE`, or `NO PROP: SPS`.

## Controls

### Flight

- `W/S`: pitch.
- `A/D`: yaw.
- `Q/E`: roll.
- `Space`: hold main engine thrust.
- `T`: toggle SAS.
- `I/K`: RCS translate forward/backward.
- `J/L`: RCS translate left/right.
- `U/O`: RCS translate up/down.

### Camera and Time

- Mouse drag: orbit camera.
- Mouse wheel: zoom camera or map.
- `C`: toggle craft/orbit camera.
- `M`: toggle map view.
- `.` / `,`: increase/decrease time warp.

### Maneuver Nodes

- `N`: create/clear maneuver node.
- Click orbit line: place node at that point.
- `[` / `]`: adjust prograde delta-v by -10/+10 m/s.
- `{` / `}`: adjust TIG by -60/+60 seconds.
- `V`: toggle auto-align to node vector.
- `B`: execute maneuver burn.
- Node editor buttons: create, clear, zero, align, burn, move to now/AP/PE, edit PRO/NRM/RAD and TIG.

### Mission Panel

- `Earth`: reset to Earth parking orbit for the current KSP-style mission loop.
- `Moon`: reset to low lunar orbit for lunar operations iteration.
- `Pad`: return to the Saturn V pad checkpoint when ascent testing is needed.
- `PRO`, `RET`, `RAD`: hold prograde, retrograde, or radial-out.
- `TLI`, `LOI`, `PDI`, `TEI`: run fixed mission burns.
- `DOCK`: set docked CSM+LM state.
- `LM`, `ASC`, `CSM`: switch active vehicle mode.
- `OFF`: cancel mission guidance and thrust.

## Short-Term Implementation Backlog

1. Add mission phase guards and warnings so buttons cannot silently create impossible states.
2. Replace fixed TLI/LOI/PDI/TEI burns with generated maneuver nodes that the existing node executor can fly.
3. Add lunar surface collision and landing classification: landed, hard landing, impact, escaped.
4. Add LM descent telemetry: radar altitude, vertical speed, horizontal speed, throttle, landing site range.
5. Persist inactive vehicle state for CSM/LM separation so rendezvous has a real target.
6. Implement simple docking gameplay: target marker, range/rate, alignment cone, capture tolerance.
7. Add event prediction to time warp: stop before SOI change, periapsis, maneuver ignition, low-altitude hazard, or impact.
8. Add mission objective/checklist state to the panel so players know what "good enough" means for each phase.
9. Add failure summary/restart controls that reset to pad, parking orbit, lunar orbit, or last major checkpoint.
10. Normalize assist ownership so mission burns and maneuver burns cannot fight over thrust or attitude.

## Engineering Notes

- Keep the existing dual-mode physics model: on-rails for coast/warp, Newtonian integration for thrust and RCS.
- Do not hide propellant costs. Every assist must call the same burn/fuel paths as manual flight.
- Favor patched-conic approximations over n-body realism until the full mission loop is fun.
- Treat Apollo numbers as believable constraints, not sacred complexity. Use handbook-derived masses/thrust/ISP where already available.
- UI should remain operational and compact: mission-control readouts, map, navball, node editor, and DSKY-style summaries.
