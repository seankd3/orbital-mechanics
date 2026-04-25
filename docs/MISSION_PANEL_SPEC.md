# Mission Panel UX Spec

Implementation target: a compact, orbit-first Apollo/KSP command panel that extends the current `#mission-panel` without becoming a tutorial page. It should answer four questions at all times: where am I, what is the next orbital action, is guidance helping or fighting me, and what went wrong if the plan fails.

## Panel Structure

- Keep the MOCR style: black background, thin line borders, uppercase labels, tabular numbers, dense grid, no decorative cards.
- Stack sections in this order: header, primary readouts, context readouts, action buttons, active checklist, warnings, event log.
- Each readout value uses a stable `data-mission` key. Buttons use stable `data-apollo` commands.
- Hide context readouts only when they do not apply; do not leave stale numbers visible across vehicle/body changes.
- Disabled commands remain visible, but expose the blocking reason through hover/focus text and an event-log entry if clicked.

## Readouts

Primary readouts, always visible:

| Label | Data | Notes |
| --- | --- | --- |
| `PHASE` | active mission/checklist phase | Use profile/checklist ids where possible. |
| `MET` | mission elapsed time | `DDD:HH:MM:SS` after 24 hours, otherwise `HHH:MM:SS`. |
| `BODY` | current gravity primary | Earth, Moon, or local analog. |
| `VEH` | active vehicle mode | Saturn V, CSM+LM, CSM, LM-D, LM-A, CM. |
| `GUID` | active assist state | Format as `IDLE`, `HOLD PRO`, `TLI BURN 2310`, etc. |
| `WRP` | time warp | Highlight when locked to 1x by event safety. |

Orbit and transfer readouts:

| Label | Data | Notes |
| --- | --- | --- |
| `AP` / `PE` | apoapsis/periapsis altitude | Show `ESC` for hyperbolic, `IMPACT` when below surface/atmosphere. |
| `TTA` / `TTP` | time to apoapsis/periapsis | Show `--` when not meaningful. |
| `ORB` | active Apollo orbit guard | Show `GO`, `PE LOW`, `AP HIGH`, `ESCAPE`, or another short issue code. |
| `ECC` | eccentricity | One to three decimals depending on magnitude. |
| `RNG` | range to current target | Moon by default during Earth-Moon phases, docking target during rendezvous. |
| `CA` | predicted closest approach | Hidden until a target exists. |
| `SOI` | next sphere-of-influence event | Include countdown when predicted. |

Burn and guidance readouts:

| Label | Data | Notes |
| --- | --- | --- |
| `NODE` | node status | `NONE`, `ARM`, `ALIGN`, `WAIT`, `BURN`, `DONE`, `STALE`. |
| `TIG` | time to ignition | Negative values mean late. |
| `DV` | total planned delta-v | Current node or assist proposal. |
| `REM` | burn delta-v remaining | During burns, use delivered finite-burn delta-v. |
| `BT` | burn duration | Use current vehicle thrust, mass, and propellant. |
| `ERR` | alignment error | Degrees from selected burn/hold vector. |

Resource readouts:

| Label | Data | Notes |
| --- | --- | --- |
| `SPS` | service propulsion propellant/delta-v | CSM and CSM+LM. |
| `DPS` | LM descent propellant/delta-v | LM descent only. |
| `APS` | LM ascent propellant/delta-v | LM ascent only. |
| `RCS` | translation/attitude propellant | Always visible after launch. |
| `RSV` | mission reserve margin | Compare available delta-v against active profile requirements. |

Context readouts:

- Rendezvous/docking: `TGT`, `RNG`, `RRATE`, `RELV`, `PHASE`, `ALIGN`, `CAPTURE`.
- Descent/landing: `RALT`, `VS`, `HS`, `SITE`, `THROT`, `TOUCH`.
- Entry: `EI`, `FPA`, `HEAT`, `G`, `SPLASH`.

## Buttons

Group buttons by task, not by implementation module.

Mission commands:

| Button | Command | Enabled When | Feedback |
| --- | --- | --- | --- |
| `Earth` | load Earth parking-orbit checkpoint | sim assist/debug enabled | Log `EARTH ORBIT READY`; start CSM+LM in map view with prograde hold. |
| `Moon` | load low lunar-orbit checkpoint | sim assist/debug enabled | Log `LUNAR ORBIT READY`; switch the active body to the Moon for lunar operations testing. |
| `Pad` | load Saturn V pad checkpoint | optional ascent testing | Return to prelaunch without making launch the main gameplay entry point. |
| `TLI` | propose or arm TLI node | stable Earth parking orbit | Do not fire immediately unless auto-burn is confirmed. |
| `LOI` | propose/arm lunar capture | lunar SOI and perilune available | Warn if perilune is unsafe or SPS reserve too low. |
| `PDI` | arm powered descent | LM descent, lunar orbit, landing site selected | Warn if CSM target orbit is invalid. |
| `ASC` | arm LM ascent | landed/surface checkpoint valid | Preserve CSM target state before liftoff. |
| `TEI` | propose/arm Earth return | CSM active in lunar orbit | Warn if return corridor cannot be solved. |
| `DOCK` | attempt capture | target in range/rate/alignment tolerance | Log soft capture, hard capture, or collision reason. |

Assist commands:

| Button | Command | Enabled When |
| --- | --- | --- |
| `PRO` / `RET` | hold prograde/retrograde | valid velocity vector exists |
| `RAD` / `RIN` | hold radial out/in | valid body-relative position exists |
| `NRM` / `AN` | hold normal/antinormal | orbit plane is defined |
| `MNV` | hold maneuver vector | node exists and is not stale |
| `ALIGN` | auto-align to selected vector | assist owner is idle or compatible |
| `BURN` | execute armed node | aligned, within ignition window, fuel available |
| `OFF` | cancel guidance/thrust | always |
| `ACK` | acknowledge top warning | active warning exists |

Vehicle commands:

- `LM`: switch to LM descent only after CSM/LM separation is valid.
- `CSM`: switch to CSM only when the CSM state is known and crew/control are available.
- `CM`: switch to command module for entry only after service module separation.

## Assist States

Use one guidance owner at a time. A new assist must cancel or refuse incompatible assists before it touches thrust, attitude, staging, time warp, or vehicle mode.

State model:

| State | Meaning |
| --- | --- |
| `IDLE` | no guidance owner |
| `ARMED` | command is valid and awaiting player confirmation or TIG |
| `ALIGN` | attitude is slewing toward target vector |
| `WAIT` | aligned and waiting for event/TIG |
| `BURN` | engine/translation assist is applying thrust |
| `HOLD` | attitude hold is active without planned burn |
| `COMPLETE` | target condition met; hold mode may remain active |
| `ABORTED` | player or safety interlock cancelled guidance |
| `FAILED` | assist could not complete and raised a failure/caution |

Manual main thrust, manual staging, vehicle switching, or `OFF` cancels incompatible assists. Manual rotation may coexist with SAS only if the existing flight model supports it; otherwise log `GUIDANCE ABORT MANUAL INPUT`.

Auto-burn rules:

- Drop to 1x before ignition.
- Start at `TIG - burnDuration / 2`.
- Cut off on target delta-v, propellant depletion, unsafe body transition, or player cancel.
- Record target delta-v, actual delta-v, cutoff reason, and residual error.

## Warnings

Severity levels: `INFO`, `CAUTION`, `WARN`, `FAIL`. The header shows the highest active severity and the affected system, for example `WARN SPS RSV LOW`.

Core warnings:

- Invalid phase/vehicle for a command.
- No propellant or insufficient reserve for armed objective.
- Periapsis below surface/atmosphere.
- Predicted lunar/earth impact.
- Maneuver node stale after SOI/body/vehicle change.
- Alignment error too high for burn.
- Time warp approaching ignition, SOI, impact, low altitude, docking, or entry.
- Docking closing speed or alignment outside tolerance.
- Landing vertical/horizontal speed outside tolerance.

Acknowledgement clears the banner only for non-fatal warnings whose condition has cleared or is marked acknowledged. Active hazards keep their banner and continue to refresh the event log at a throttled cadence.

## Event Log

The log is append-only for the session and shows the latest five to eight entries in-panel. Each entry uses:

`MET SEVERITY CODE MESSAGE`

Examples:

- `000:00:00 INFO EARTH ORBIT READY`
- `002:44:10 CAUTION PE BELOW ATM`
- `075:31:20 WARN SPS RSV LOW`
- `102:05:44 FAIL LUNAR IMPACT`

Requirements:

- Use stable `CODE` strings for tests and save files.
- Coalesce duplicate warnings by updating count and latest MET.
- Store full entries in mission state even if the panel only renders the tail.
- Clicking/focusing an entry may show recovery actions from `APOLLO_FAILURES` when an id is attached.

## Checklist Integration

Use `window.APOLLO_CHECKLISTS` as the checklist source of truth.

- Map mission `phase` to `APOLLO_CHECKLISTS.phases[phaseId]`; fall back to nearest profile objective phase.
- Render active phase label, objective, current step, and completion count, for example `CHK 3/7 GUIDANCE SETUP`.
- Step states: `TODO`, `ACTIVE`, `DONE`, `SKIP`, `BLOCKED`.
- Auto-mark `DONE` when success criteria can be evaluated from telemetry. Keep manual check/skip for criteria that are descriptive.
- Block phase-critical commands until required checklist steps are `DONE` or explicitly skipped with a logged `CAUTION CHK SKIP`.
- Surface `cautionCriteria` as warnings when their conditions become detectable.

Checklist controls:

- `CHK`: expand/collapse checklist detail.
- `PREV` / `NEXT`: move active checklist step.
- `DONE`: manually complete current step.
- `SKIP`: skip non-required step with reason logged.

## Data Module Integration

Panel rendering should consume a single snapshot object rather than reading scattered globals in the DOM layer.

Recommended snapshot shape:

```js
{
  time, phase, profileId, body, vehicleMode,
  orbit: { apoapsis, periapsis, eccentricity, timeToAp, timeToPe },
  target: { id, range, rangeRate, relativeVelocity, closestApproach },
  guidance: { owner, state, mode, targetVector, alignmentError, nodeId, tig, burn },
  resources: { sps, dps, aps, rcs, reserveDeltaV },
  checklist: { phaseId, stepId, state, completed, total },
  warnings: [{ id, severity, code, message, failureId }],
  events: [{ met, severity, code, message, failureId }]
}
```

Module bindings:

- `APOLLO_PROFILES`: phase order, target values, required reserves, scenario scoring, checkpoint labels.
- `APOLLO_CHECKLISTS`: checklist phase/step text, trigger hints, success criteria, caution criteria.
- `APOLLO_FAILURES`: warning/failure metadata, severity labels, recovery actions, stable failure ids.
- `ApolloTelemetryRecorder`: sampled state for post-failure summaries, event export, min/max altitude/velocity/fuel snapshots.

If a data module is absent, the panel must degrade to live mission telemetry and log one `INFO DATA MODULE MISSING <name>` entry.

## Keyboard Shortcuts

Do not bind panel shortcuts while the DSKY or any text input has focus. Native `Tab`, `Shift+Tab`, `Enter`, and `Space` must work for focused buttons.

Global flight/node keys remain as documented: attitude controls, `Space` thrust, `T` SAS, RCS translation, `M` map, `C` camera, `.`/`,` warp, `N` node, `V` align, `B` burn.

Panel shortcuts:

| Shortcut | Action |
| --- | --- |
| `Esc` | `OFF` / cancel active guidance |
| `Shift+E` | `Earth` / load Earth orbit checkpoint |
| `Shift+L` | `Moon` / load lunar orbit checkpoint |
| `Shift+P` | hold prograde |
| `Shift+R` | hold retrograde |
| `Shift+H` | cycle radial/normal hold group |
| `Shift+B` | execute armed burn |
| `Shift+C` | expand/collapse checklist |
| `Shift+A` | acknowledge active warning |
| `Shift+1..9` | activate visible mission action buttons in order |

Every shortcut uses the same enable gates and logging as the corresponding button.

## Failure Feedback

Failures must be specific, actionable, and recoverable when the mission design allows it.

On failure:

- Stop time warp and cancel active thrust/guidance.
- Show a persistent `FAIL` banner with cause code, not a generic game-over label.
- Log the failure with linked `APOLLO_FAILURES` id when available.
- Freeze or slow simulation only if continuing would immediately destroy useful context.
- Show a compact failure summary: phase, vehicle, body, last command, triggering readout, remaining propellant, and nearest checkpoint.
- Offer actions: `RETRY`, `CHECKPOINT`, `OBSERVE`, and phase-specific recovery when possible.

Required failure causes:

- `FAIL IMPACT EARTH` / `FAIL IMPACT MOON`
- `FAIL HARD LANDING`
- `FAIL NO PROP SPS|DPS|APS|RCS`
- `FAIL MISSED SOI`
- `FAIL NO CAPTURE`
- `FAIL UNSAFE ORBIT`
- `FAIL DOCK COLLISION`
- `FAIL BAD CONFIG`
- `FAIL GUIDANCE NO SOLUTION`
- `FAIL ENTRY CORRIDOR`

Acceptance criteria:

- No command fails silently.
- Every disabled or rejected command names the blocking condition.
- Every assist exposes owner, state, target, and cancel path.
- Checklist state and command availability agree.
- Failure feedback gives the player a next action without hiding the telemetry that caused the failure.
