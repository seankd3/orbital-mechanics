# LM Rendezvous Loop Spec

This document specifies the next playable Lunar Module loop after lunar orbit insertion: preserve the passive CSM target, undock the LM, descend and land, launch the ascent stage, phase back to the CSM, perform terminal approach, dock, and recover cleanly from common failures.

The goal is an implementation-ready gameplay slice, not a validated Apollo guidance model. It should feel like a flight-director exercise: the player sees target geometry, chooses or accepts suggested burns, spends real propellant, and can recover from bad-but-not-terminal states.

## Scope

### In

- CSM target persistence while the LM is active or landed.
- Explicit active/inactive vehicle state for CSM, LM descent, and LM ascent.
- LM undock and separation from a stable low lunar orbit.
- LM descent state sufficient to reach a classified surface checkpoint.
- LM ascent launch from a saved landing site into a bound lunar orbit.
- Ascent insertion gates, rendezvous phasing, terminal approach, and docking.
- Docking success/failure tolerances with RCS-based correction.
- Failure, warning, checkpoint, and recovery contracts for the loop.

### Out

- Full terrain hazards, slope maps, landing gear dynamics, or detailed surface EVA.
- Historical P63/P64/P65 guidance modes beyond gameplay-equivalent assist states.
- Multi-target rendezvous, CSM active rescue maneuvers, or LM abort staging variants beyond a simple ascent abort.
- TEI and Earth entry; this slice ends with CSM active and rendezvous complete.

## Existing Contracts To Reuse

- `Spacecraft.vehicleMode`: use `csm-lm`, `csm`, `lm-descent`, and `lm-ascent` as the active vehicle modes.
- `Spacecraft` propellant and mass methods: `getCurrentMass()`, `getDeltaV()`, `setThrust()`, `burnSPS()`, `burnRCS()`, `setPosition()`, and `setVelocity()`.
- `ApolloMission`: owns mission phase, panel commands, logs, primary-body context, and mission guidance.
- `Scene.maneuver`: owns editable maneuver nodes, auto-align, auto-burn, predicted orbit, and burn execution.
- `ApolloRendezvousPlanner`: use its phase, coelliptic, relative-motion, and terminal-phase helpers once target state exists.
- `APOLLO_CHECKLISTS`, `APOLLO_PROFILES`, and `APOLLO_FAILURES`: use their ids and labels where present; runtime phase names should map to canonical lower-case phase ids.

Mission assists may create or update maneuver nodes, but `Scene` remains the owner of node execution. Only one owner may command main thrust at a time.

## Canonical Phases

Use these phase ids for checkpoints, logs, failure tags, and panel state:

| Phase Id | Active Vehicle | Required State |
| --- | --- | --- |
| `lunar-orbit` | `csm-lm` | Docked stack in stable lunar orbit. |
| `lm-undock` | `lm-descent` | CSM target exists and is on rails. |
| `powered-descent` | `lm-descent` | LM active, CSM target valid, landing site selected. |
| `surface` | `lm-descent` | LM safely landed, CSM target still propagated. |
| `lm-ascent` | `lm-ascent` | Surface state valid, ascent stage available. |
| `ascent-insertion` | `lm-ascent` | LM in bound lunar orbit below or near CSM orbit. |
| `rendezvous-phasing` | `lm-ascent` | CSM target range/phase can be computed. |
| `terminal-approach` | `lm-ascent` | Range and relative velocity are inside approach corridor. |
| `docking` | `lm-ascent` | Docking attempt armed or in contact. |
| `rendezvous-complete` | `csm` or `csm-lm` | Docking captured; TEI may be enabled. |

## State Model

Add a mission-owned object for inactive vehicles and rendezvous state. The names below are descriptive; implementation may keep them in `ApolloMission` or a small helper owned by it.

```js
mission.vehicles = {
  activeId: 'lm',
  csm: VehicleState,
  lm: VehicleState,
  lmDescentStage: VehicleState | null
};

VehicleState = {
  id: 'csm' | 'lm' | 'lm-descent-stage',
  vehicleMode: 'csm' | 'lm-descent' | 'lm-ascent',
  bodyId: 'moon',
  position: THREE.Vector3,      // visualization-space inertial position
  velocity: THREE.Vector3,      // visualization-space inertial velocity
  quaternion: THREE.Quaternion,
  spsPropellant: number,
  spsMaxPropellant: number,
  rcsPropellant: number,
  rcsMaxPropellant: number,
  dryMass: number,
  thrust: number,
  isp: number,
  landed: boolean,
  landingSite: SurfaceState | null,
  lastUpdatedMet: number,
  valid: boolean
};

SurfaceState = {
  bodyId: 'moon',
  latDeg: number,
  lonDeg: number,
  radiusM: number,
  normalVisual: THREE.Vector3,
  eastVisual: THREE.Vector3,
  northVisual: THREE.Vector3,
  met: number
};

mission.rendezvous = {
  targetId: 'csm',
  chaserId: 'lm',
  mode: 'none' | 'phasing' | 'terminal' | 'docking' | 'captured' | 'failed',
  lastSolutionMet: number,
  rangeM: number,
  rangeRateMps: number,
  relativeVelocityMps: number,
  phaseAngleDeg: number,
  altitudeDifferenceM: number,
  closestApproachM: number | null,
  timeToClosestApproachS: number | null,
  suggestedNode: RendezvousNodeSuggestion | null,
  contactState: 'none' | 'soft-capture' | 'hard-capture' | 'collision'
};
```

### State Copy Rules

- `captureActiveVehicleState(id)` copies the active `spacecraft` state, propellant pools, mass settings, attitude, body, and MET into `mission.vehicles[id]`.
- `restoreActiveVehicleState(id)` copies a `VehicleState` back into the single runtime `spacecraft`, calls `spacecraft.setVehicleMode(vehicleMode)`, then reapplies saved propellant and mass fields that `setVehicleMode()` would reset.
- Inactive CSM propagation runs before rendezvous telemetry is read. Propagate by the same patched-conic/on-rails logic used by the active craft during warp: lunar-relative Keplerian propagation when bound, linear/integrated fallback only if orbit calculation fails.
- If the primary body changes or target propagation produces non-finite state, set `VehicleState.valid = false`, raise `FAIL CSM TARGET LOST`, and block ascent/rendezvous/docking commands.
- CSM state is authoritative during LM phases. Do not infer the CSM target from the current active LM orbit.

## Numeric Targets

These are gameplay tolerances for the first playable slice. Keep them in one constant table so scenarios can tighten them later.

| Constant | Value | Notes |
| --- | ---: | --- |
| CSM parking lunar orbit | 100000-120000 m altitude | Target nominal: 110000 m circular. |
| Minimum valid CSM periapsis | 15000 m | Below this, warn; impact prediction can fail the mission. |
| LM descent start orbit | 100000-120000 m altitude | Same as CSM before undock. |
| DOI/perilune target | 15000-18000 m | Optional first slice; can be a guided lowering burn. |
| Safe touchdown vertical speed | <= 2.0 m/s | `<= 3.0 m/s` is hard landing but recoverable only by scenario rule. |
| Safe touchdown horizontal speed | <= 1.0 m/s | `<= 2.5 m/s` is hard landing. |
| Landing ellipse radius | 5000 m | First slice can use a circular ellipse around the selected site. |
| LM ascent insertion periapsis | >= 15000 m | Must be above lunar surface. |
| LM ascent insertion apoapsis | 40000-120000 m | Prefer a lower coelliptic orbit than CSM. |
| LM ascent plane error | <= 3.0 deg | Warn above 1.5 deg; fail only if no correction remains. |
| Phasing-ready phase error | <= 5.0 deg | Relative to `ApolloRendezvousPlanner.phaseAngleEstimate()`. |
| TPI-ready range | 15000-120000 m | Matches planner helper defaults. |
| Terminal approach entry range | <= 15000 m | Switch from orbital burns to RCS/relative velocity. |
| Stationkeeping range | 50-200 m | Target hold point before docking. |
| Docking capture range | <= 5.0 m | Measured port-to-port or center-proxy until ports exist. |
| Docking closing speed | <= 0.20 m/s | Soft capture. |
| Docking caution closing speed | > 0.20 m/s | Warn and allow back-out before contact. |
| Docking collision speed | > 0.50 m/s | Fail docking attempt. |
| Docking alignment error | <= 7 deg | Use craft forward vector vs target docking axis. |
| Docking lateral offset | <= 1.5 m | Center-proxy until docking ports exist. |
| RCS reserve for docking | >= 8% | Warn below; fail if depleted during terminal approach. |

## Command Flow

### `LM` / Undock

Enabled when:

- Active body is the Moon.
- Active vehicle is `csm-lm`.
- Current lunar orbit is bound with periapsis above 15000 m.
- No maneuver burn or mission burn is active.

Behavior:

1. Capture docked stack state.
2. Create `mission.vehicles.csm` by copying the docked stack state, switching its saved mode to `csm`, and preserving CSM SPS/RCS resources.
3. Create `mission.vehicles.lm` by copying the docked stack state, switching active runtime to `lm-descent`, and preserving LM DPS/RCS resources.
4. Apply a small separation impulse to the active LM only: 0.15-0.30 m/s radial-out or local docking-axis translation.
5. Keep the CSM on its original orbit with no impulse unless a later CSM rescue feature exists.
6. Set phase to `lm-undock`, target to CSM, guidance idle, and log `INFO LM UNDOCK`.

Failure/guardrails:

- Invalid orbit: reject with `WARN CSM ORBIT INVALID`.
- Active burn: reject with `CAUTION GUIDANCE BUSY`.
- Existing invalid CSM target: reject with `FAIL CSM TARGET LOST`.

### `PDI` / Descent

Enabled when:

- Active vehicle is `lm-descent`.
- CSM target is valid.
- Active body is the Moon.
- LM orbit is bound and perilune can be computed.
- Landing site is selected or defaulted from the active profile.

First playable behavior:

1. If the LM is still near the CSM orbit, create a DOI node to lower perilune to 15000-18000 m.
2. At low perilune, arm PDI as either a generated node or a mission guidance state using the LM DPS propellant path.
3. Show descent readouts: radar altitude, vertical speed, horizontal speed, site range, DPS percent, RCS percent, and touchdown prediction.
4. During descent, guidance may hold surface retrograde and limit vertical speed, but player input and propellant limits remain decisive.
5. On surface contact, classify the landing and transition to `surface` only if inside safe limits.

Landing classification:

| Outcome | Condition | Runtime Result |
| --- | --- | --- |
| `landed` | Altitude <= 0, vertical speed <= 2.0 m/s, horizontal speed <= 1.0 m/s, inside ellipse | Stop thrust, freeze LM to surface state, save checkpoint. |
| `hard-landing` | Altitude <= 0 and rates exceed safe limits but stay below impact limits | Raise `FAIL HARD LANDING`; allow checkpoint retry. |
| `impact` | Vertical speed > 5.0 m/s or horizontal speed > 5.0 m/s | Raise `FAIL IMPACT MOON`; terminal for Apollo 11-style scenario. |
| `out-of-zone` | Safe rates but outside landing ellipse | Raise `WARN LANDING OUT OF ZONE`; scenario may fail or allow degraded surface checkpoint. |
| `no-prop-dps` | DPS reaches zero before surface safe state | Raise `FAIL NO PROP DPS`; offer ascent abort if altitude and ascent stage are valid. |

### Surface Checkpoint

At safe touchdown:

- Save `SurfaceState` from the LM's Moon-relative position.
- Set active vehicle to landed `lm-descent` with thrust off and guidance idle.
- Continue propagating the CSM target on rails.
- Create checkpoint `surface`.
- Enable `ASC`.
- Block `TEI`, `LOI`, and `CSM` unless a scenario explicitly allows abandoning the LM.

Required readouts:

- `TGT CSM`
- `RNG`
- `PHASE`
- `CSM PE/AP`
- `DPS`
- `APS`
- `RCS`
- `ASC WINDOW`, using the phasing estimate or `--` if not computed.

### `ASC` / LM Ascent

Enabled when:

- Phase is `surface`.
- Surface state is valid.
- CSM target is valid and in a safe lunar orbit.
- LM ascent stage propellant is available.

Behavior:

1. Capture or discard descent-stage state as `mission.vehicles.lmDescentStage`.
2. Restore the active LM at the saved surface position, switch to `lm-ascent`, and reset only the ascent-stage mass/APS/RCS values that belong to the ascent stage.
3. Compute target CSM orbit plane and current phase angle before liftoff.
4. Launch with a simple pitch program:
   - 0-12 s: hold surface normal, full APS thrust.
   - 12-120 s: pitch toward local horizontal in the CSM orbital plane.
   - After 120 s: steer toward prograde with normal correction limited to keep plane error shrinking.
5. Cut off or stop auto-ascent when insertion gates are met, propellant is depleted, or the player presses `OFF`.
6. Set phase to `ascent-insertion` after cutoff if the orbit is bound and above the minimum periapsis.

Ascent insertion target:

- Periapsis >= 15000 m.
- Apoapsis 40000-120000 m.
- Prefer an orbit 10000-30000 m below the CSM to let the LM gain phase.
- Plane error <= 3 deg.
- APS remaining >= 5% recommended; warn if lower but do not fail solely for low fuel.

Failure/guardrails:

- `FAIL NO PROP APS`: APS depleted before bound orbit.
- `FAIL ASCENT INSERTION`: orbit is suborbital, escaping, or periapsis below surface after cutoff.
- `WARN ASCENT PLANE ERROR`: plane error > 3 deg with RCS/APS correction still possible.
- `FAIL CSM TARGET LOST`: CSM state invalid during ascent.

## Rendezvous Phasing

Rendezvous starts after a valid ascent insertion. It is split into orbital phasing and terminal approach so the player has a readable path instead of one magic dock button.

### Telemetry

Update at least every frame in 1x and after each on-rails propagation step in warp:

- CSM range in meters.
- Range rate in m/s; negative means closing.
- Relative velocity magnitude in m/s.
- Target lead phase angle in degrees.
- LM and CSM altitude difference.
- Predicted closest approach and time to closest approach over the next orbit.
- Current planner recommendation.

### Planner Use

Call `ApolloRendezvousPlanner` with Moon defaults unless the active body supplies mass/radius:

- `phaseAngleEstimate({ chaserAltitudeM, targetAltitudeM })` for the desired transfer phase.
- `relativeMotionSummary({ chaserAltitudeM, targetAltitudeM, currentPhaseAngleDeg, rangeM, rangeRateMps })` for panel language and drift state.
- `coellipticAltitudeSuggestion({ targetAltitudeM, phaseAngleDeg, desiredCatchupTimeS })` to suggest a phasing orbit when the LM is too high/low.
- `terminalPhaseInitiationHeuristic({ rangeM, rangeRateMps, phaseErrorDeg, altitudeDifferenceM })` to decide when TPI may be armed.

### Assist Behavior

Rendezvous assists should generate editable nodes rather than directly applying invisible velocity changes.

`PHASE` assist:

1. Evaluate current LM and CSM orbits.
2. If altitude separation is outside the desired band, suggest a prograde/retrograde node at apoapsis or periapsis to enter a coelliptic orbit below the CSM.
3. If phase is nearly correct, suggest a transfer node targeting closest approach inside 5000 m.
4. Store the suggestion in `mission.rendezvous.suggestedNode`.
5. Populate `Scene.maneuver` with the node, leave it armed/editable, and log `INFO RV NODE READY`.

`TPI` assist:

1. Require the terminal-phase heuristic to be ready or allow a player override with a caution log.
2. Create a node that reduces closest approach and planned relative velocity at intercept.
3. Drop time warp before TIG and use normal `Scene` auto-align/auto-burn if armed.
4. After the burn, recompute rendezvous telemetry and either continue phasing or transition to `terminal-approach`.

Time warp:

- Allow warp during phasing only while no burn is active and no closest approach, SOI change, perilune, or low-altitude hazard occurs within the next integration step.
- Force 1x inside 15000 m range, within 120 s of closest approach, during any RCS activity, and during docking.

## Terminal Approach

Enter `terminal-approach` when range <= 15000 m and the next closest approach is recoverable with available RCS.

Approach corridor:

| Range Band | Target Closing Rate | Required Action |
| --- | ---: | --- |
| 15000-5000 m | <= 10.0 m/s | Trim relative velocity and keep closest approach improving. |
| 5000-1000 m | <= 3.0 m/s | Brake and keep line-of-sight rate low. |
| 1000-200 m | <= 1.0 m/s | Match velocity, approach along target axis. |
| 200-50 m | <= 0.3 m/s | Stationkeep, align, and wait for docking clearance. |
| < 50 m | <= 0.2 m/s | Docking mode only. |

RCS controls remain manual via existing translation inputs. Assist may offer:

- `HOLD RELV`: point/translate to reduce relative velocity.
- `BRAKE`: pulse opposite relative velocity until the current range band target is met.
- `STATION`: hold 50-200 m range with relative velocity <= 0.1 m/s.
- `DOCK ARM`: enable docking capture checks.

The first slice may use the CSM centerline as a docking axis:

- CSM docking axis: saved CSM forward vector or the negative of the LM-to-CSM line if no port transform exists.
- LM docking axis: active spacecraft forward vector.
- Alignment error: angle between LM forward and target docking axis.
- Lateral offset: line-of-sight component perpendicular to target docking axis.

## Docking

`DOCK` changes from an unconditional mode switch to an attempt against tolerance.

Enabled when:

- Phase is `terminal-approach` or `docking`.
- Target is valid CSM.
- Range <= 50 m for arming; capture only at <= 5 m.
- Relative velocity and alignment are visible in the panel.

Attempt results:

| Result | Conditions | Runtime Result |
| --- | --- | --- |
| `soft-capture` | Range <= 5 m, closing speed <= 0.20 m/s, alignment <= 7 deg, lateral offset <= 1.5 m | Log `INFO DOCK SOFT CAPTURE`, zero relative velocity, move to captured state. |
| `hard-capture` | Soft capture achieved and player confirms or timer > 3 s | Merge LM with CSM, switch active vehicle to `csm` or `csm-lm`, clear target, save checkpoint. |
| `retry` | Range <= 5 m but closing speed <= 0.50 m/s or alignment <= 15 deg | Log `WARN DOCK OUT OF TOL`, bounce/back-out by 0.1 m/s, stay in terminal approach. |
| `collision` | Closing speed > 0.50 m/s, alignment > 15 deg at contact, or lateral offset > 3 m | Raise `FAIL DOCK COLLISION`, preserve state for retry/checkpoint. |
| `miss` | Closest approach passes and range opens above 500 m without capture | Raise `WARN DOCK MISSED`, suggest phasing or terminal retry. |

On hard capture:

1. Capture LM ascent propellant remaining for scoring.
2. Restore CSM as active vehicle.
3. If the gameplay model needs a docked stack for TEI mass, switch to `csm-lm`; otherwise switch to `csm` and log LM ascent stage secured/jettisoned.
4. Clear `mission.rendezvous.targetId` or mark it captured.
5. Set phase `rendezvous-complete`.
6. Enable TEI planning.

## Mission Panel Requirements

Add or populate these readouts when a CSM target exists:

| Label | Meaning |
| --- | --- |
| `TGT` | `CSM`, `NONE`, or `LOST`. |
| `RNG` | Current target range. |
| `RRATE` | Range rate; prefix closing/opening in tooltip or compact text. |
| `RELV` | Relative velocity magnitude. |
| `PHASE` | Target lead angle in degrees during phasing. |
| `CA` | Predicted closest approach distance and countdown. |
| `ALTDIFF` | LM altitude minus CSM altitude. |
| `ALIGN` | Docking-axis alignment error in degrees. |
| `CAPTURE` | `NO`, `ARM`, `SOFT`, `HARD`, `MISS`, or `COLLISION`. |

Command button gates:

- `LM`: undock only from lunar `csm-lm` orbit.
- `PDI`: only in `lm-descent` with valid CSM target and descent prerequisites.
- `ASC`: only from safe surface checkpoint.
- `PHASE` or `RV`: only after ascent insertion.
- `TPI`: only when planner readiness passes or player confirms override.
- `DOCK`: only inside terminal approach with target telemetry valid.
- `CSM`: disabled while LM is landed or not docked, except checkpoint/recovery tools.

All disabled clicks should log a compact reason, for example `CAUTION ASC NEED SURFACE`, `WARN DOCK RANGE HIGH`, or `FAIL CSM TARGET LOST`.

## Failure And Recovery

Use stable failure codes in the mission log. Severity can escalate according to scenario context.

| Code | Trigger | Recovery |
| --- | --- | --- |
| `WARN CSM ORBIT INVALID` | CSM PE below 15000 m, escape, impact prediction, or non-finite target orbit. | Recompute target, restore lunar orbit checkpoint, or abort LM operations before descent. |
| `FAIL CSM TARGET LOST` | CSM state missing, invalid, or cannot be propagated. | Restart from `lunar-orbit`, `surface`, or `ascent-start` checkpoint if present. |
| `FAIL HARD LANDING` | Touchdown exceeds safe rate but not impact rate. | Retry from `descent-start` or accept degraded state only in sandbox. |
| `FAIL IMPACT MOON` | LM contacts Moon above impact threshold. | Retry from `descent-start`, `surface`, or `ascent-start` depending on last checkpoint. |
| `FAIL NO PROP DPS` | Descent engine propellant depleted before safe touchdown. | Abort to ascent stage if high enough and ascent stage is available; otherwise retry. |
| `FAIL NO PROP APS` | Ascent stage propellant depleted before valid orbit. | Retry from `surface` or `ascent-start`. |
| `FAIL ASCENT INSERTION` | LM ascent cutoff leaves suborbital, escaping, or surface-intersecting orbit. | Create correction node if propellant remains; otherwise retry ascent. |
| `WARN RENDEZVOUS PHASE BAD` | Phase error outside planner corridor. | Suggest coelliptic phasing node. |
| `WARN TERMINAL CLOSING HIGH` | Closing rate exceeds current range-band target. | Brake with RCS, back out, or return to phasing. |
| `FAIL NO PROP RCS` | RCS depleted during terminal approach or docking. | Retry from rendezvous checkpoint or accept failed rendezvous in sandbox. |
| `WARN DOCK OUT OF TOL` | Contact conditions slightly outside capture tolerance. | Back out, null rates, retry docking. |
| `FAIL DOCK COLLISION` | Contact exceeds collision speed/alignment/offset limits. | Retry from terminal approach or rendezvous checkpoint. |
| `WARN DOCK MISSED` | Closest approach passes without capture and range opens. | Recompute TPI or return to phasing. |

Checkpoint requirements:

- `lunar-orbit`: docked CSM+LM before undock.
- `descent-start`: LM descent active with valid CSM target before PDI.
- `surface`: safe landed LM with propagated CSM target.
- `ascent-start`: LM ascent on surface just before liftoff.
- `rendezvous-start`: LM ascent in valid phasing orbit with CSM target.
- `terminal-approach`: range <= 15000 m with recoverable relative velocity.

Recovery controls should preserve learning context. A terminal failure should stop warp, stop thrust, leave vehicles visible where possible, show the violated value, and offer the nearest checkpoint rather than resetting to the pad.

## Implementation Slices

### Slice 1: Target Persistence And Undock

- Add `VehicleState` snapshot/restore helpers.
- Add CSM target creation during `LM` command.
- Propagate inactive CSM on rails.
- Add target telemetry: range, range rate, relative velocity, phase angle.
- Gate `PDI`, `ASC`, `CSM`, and `DOCK` against target validity.

Acceptance:

- From a 110 km lunar orbit, pressing `LM` creates a valid CSM target and active LM without changing the CSM orbit.
- Time warp advances both LM and CSM states without NaN values or visible jumps.
- Invalid CSM target blocks descent/ascent/rendezvous with a named log code.

### Slice 2: Descent And Surface Checkpoint

- Add landing-site default from Apollo 11 profile or current sub-LM point.
- Add radar altitude, vertical/horizontal speed, and touchdown classification.
- Persist surface state.
- Keep CSM target propagating while LM is landed.
- Add `surface` checkpoint.

Acceptance:

- Safe contact creates a surface checkpoint and enables `ASC`.
- Hard landing and impact produce distinct failure codes.
- CSM target remains valid after at least one CSM orbit of surface time warp.

### Slice 3: Ascent Insertion

- Add ascent-stage activation from surface state.
- Implement simple pitch-program ascent guidance.
- Evaluate insertion gates and save `rendezvous-start`.
- Log and recover from failed ascent insertion.

Acceptance:

- From the surface checkpoint, `ASC` can place the LM in a bound lunar orbit with PE >= 15000 m.
- APS propellant is consumed through the same propellant path as other main-engine burns.
- Failed ascent leaves a useful retry state and named failure.

### Slice 4: Phasing And TPI

- Wire `ApolloRendezvousPlanner` to live target telemetry.
- Add `PHASE` and `TPI` assist commands or mission-panel actions.
- Generate editable maneuver nodes for phasing and TPI.
- Add closest approach prediction and warp stops.

Acceptance:

- A player can use assisted nodes to reduce closest approach below 15000 m.
- Planner recommendations update after each burn.
- Warp stops before closest approach and active burns.

### Slice 5: Terminal Approach And Docking

- Add terminal range-band checks and RCS approach readouts.
- Implement docking-axis approximation, alignment, lateral offset, and capture checks.
- Replace unconditional `DOCK` with tolerance-based capture/failure.
- On hard capture, restore CSM/docked vehicle state and set `rendezvous-complete`.

Acceptance:

- Docking below tolerance succeeds and enables TEI.
- Excess closing speed or alignment fails with `FAIL DOCK COLLISION`.
- Slightly bad contact backs out and allows retry without corrupting vehicle state.

## Test Matrix

Manual and automated checks should cover these cases:

| Id | Setup | Expected |
| --- | --- | --- |
| `LM-RV-01` | 110 km circular lunar `csm-lm`; press `LM`. | Active LM separates, CSM target persists, range starts small and finite. |
| `LM-RV-02` | Same as above; warp one lunar orbit. | CSM target propagates, orbit stays bound, no NaN telemetry. |
| `LM-RV-03` | Invalidate CSM target then press `PDI` or `ASC`. | Command rejected with `FAIL CSM TARGET LOST`; no thrust. |
| `LM-RV-04` | Perform safe descent contact. | Phase becomes `surface`, checkpoint saved, `ASC` enabled. |
| `LM-RV-05` | Descent contact at high vertical speed. | `FAIL HARD LANDING` or `FAIL IMPACT MOON` according to threshold. |
| `LM-RV-06` | From surface, run ascent guidance. | LM reaches bound orbit with PE >= 15000 m or fails with `FAIL ASCENT INSERTION`. |
| `LM-RV-07` | After insertion, request phasing assist. | Node is created/updated; no direct hidden velocity change occurs. |
| `LM-RV-08` | Execute phasing/TPI until range <= 15000 m. | Phase becomes `terminal-approach`; warp forced to 1x. |
| `LM-RV-09` | Approach at <= 0.20 m/s, <= 7 deg, <= 1.5 m offset, range <= 5 m; press `DOCK`. | Soft then hard capture; phase `rendezvous-complete`; TEI enabled. |
| `LM-RV-10` | Approach at > 0.50 m/s at contact. | `FAIL DOCK COLLISION`; checkpoint retry available. |
| `LM-RV-11` | Deplete RCS during terminal approach. | `FAIL NO PROP RCS`; docking blocked. |
| `LM-RV-12` | Press `CSM` while LM is landed or in free flight. | Command rejected unless a recovery tool is explicitly selected. |

## Done Definition

The loop is playable when a user can start from a stable lunar orbit checkpoint, undock the LM, land safely, launch the ascent stage, see and use CSM target telemetry, complete at least one phasing/TPI correction, fly a terminal RCS approach, dock inside tolerance, and continue as the CSM/docked stack without using developer shortcuts.

Failures must identify the violated condition and offer a nearby checkpoint. No command in this loop may silently create an impossible body, vehicle, propellant, or target state.
