# Apollo Failure And Warning System

This document specifies the Apollo game failure and warning system. It is a gameplay contract for future implementation, not a source-code integration. The goal is to make failures teach the player what changed, why it matters, and what can still be done without turning the project into a full spacecraft systems simulator.

Failure handling should follow the existing design direction in `docs/APOLLO_GAMEPLAY.md`, `docs/SCENARIO_BACKLOG.md`, and `docs/TEST_PLAN.md`: clear cause labels, visible consequences, recoverable checkpoints, and compact mission-control UI.

## Goals

- Name the actionable cause of a problem, not just the symptom.
- Escalate from advisory to mission loss only when the current phase and scenario rules make that true.
- Stop time warp before a hazard becomes unrecoverable.
- Preserve player agency with trim burns, aborts, retries, checkpoint restarts, and checklist guidance.
- Use the same physics, propellant, vehicle, maneuver-node, and scenario state as normal play.
- Keep failure data stable enough for logs, saves, telemetry exports, and scenario definitions.

## Severity Levels

The runtime severity names should match the standalone `APOLLO_FAILURES.severityLevels` values: `info`, `caution`, `warning`, and `critical`.

| Severity | Log Prefix | Meaning | UI Behavior | Runtime Behavior |
| --- | --- | --- | --- | --- |
| `info` | `INFO` | Advisory state, invalid input, expected condition, or noncritical checklist note. | Add a normal log row and optional small annunciator. | No automatic intervention. |
| `caution` | `CAUTION` | A margin is being consumed or a player action is needed soon. | Add a highlighted log row, show active caution count, and keep the related checklist item visible. | Drop warp to a safe inspection factor when the hazard is time-sensitive. |
| `warning` | `WARN` | A major objective is threatened unless corrected quickly. | Use master-warning styling, keep the warning sticky until cleared or acknowledged, and show the primary recovery action. | Force warp to `1x` for active burns, low-altitude hazards, docking contact, landing, entry, and imminent SOI/capture decisions. |
| `critical` | `FAIL` | Crew survival, vehicle survival, or the scenario success condition is in immediate danger or already lost. | Show a failure banner or emergency panel with cause, phase, and recovery/restart options. | Cancel incompatible assists, force `1x`, record a scenario failure if the condition is terminal, and preserve the post-failure state for review. |

Severity is contextual. `PE BELOW SURFACE` can be a `warning` during planning, `critical` during time warp toward impact, and a terminal `FAIL` after collision. Expected events such as planned communications blackout should not raise a warning unless the scenario marks them unexpected or the blackout blocks a required update.

## Trigger Categories

Every event should belong to one primary trigger category and may include secondary systems for filtering.

### Trajectory And Orbit

Use for unsafe or missed flight-path states.

- Periapsis below body surface or atmosphere.
- Apoapsis/periapsis outside scenario bounds.
- Hyperbolic escape when capture or return is required.
- Missed lunar SOI after TLI.
- Missed lunar capture after LOI.
- Failed Earth-return corridor after TEI.
- Predicted entry angle too shallow or too steep.
- Free-return corridor lost.

### Burn And Guidance

Use for maneuver execution faults.

- Overburn or underburn relative to planned delta-v.
- Burn starts late, early, or while misaligned.
- Node is stale after SOI or primary-body change.
- Assist cannot compute a valid vector.
- Auto-burn and mission burn compete for thrust ownership.
- Primary body changes during an armed burn.

### Propulsion And Resources

Use for depleted or insufficient consumables.

- SPS, DPS, APS, or RCS propellant below phase reserve.
- Engine commanded with no propellant.
- Engine fails to ignite or produces insufficient thrust in a scenario that models failures.
- RCS unavailable during docking, rendezvous, attitude hold, or entry.
- Apollo 13-style power, oxygen, water, battery, or CO2 margins in scenario mode.

### Vehicle Configuration And Phase Guards

Use for commands that are invalid for the current body, vehicle, or mission phase.

- LOI outside lunar SOI.
- PDI outside lunar orbit or before LM activation.
- TEI in LM-only mode.
- Stage command after no stages remain.
- Docking command outside proximity conditions.
- Entry preparation before command module configuration exists.
- Vehicle switch that would discard a required active objective.

### Collision, Landing, And Docking

Use for proximity outcomes.

- Earth or Moon impact above survivable limits.
- Lunar touchdown outside vertical, horizontal, slope, or landing-zone bounds.
- LM descent fuel depleted before safe touchdown or abort.
- Docking closing speed, angle, or lateral offset exceeds tolerance.
- Rendezvous collision or target miss.
- CSM target orbit invalid during LM ascent/rendezvous.

### Time Warp And Event Stops

Use for hazards created by skipping over decisive events.

- Warp would cross maneuver ignition without arming burn state.
- Warp would cross SOI transition, periapsis, low-altitude hazard, closest approach, landing, docking contact, or entry interface.
- Warp remains above allowed factor during lunar SOI, burn, landing, rendezvous, or entry.
- Predictor confidence is too low to safely continue high warp.

### Crew Interface, DSKY, And Communications

Use for player-input and guidance-interface problems.

- Invalid DSKY verb/noun/program input.
- Program alarm during time-critical guidance.
- Required checklist item skipped.
- Unexpected communications loss.
- Ground update unavailable when a scenario requires it.

## Event Lifecycle

Failures and warnings should be stateful. The runtime should not just append text each frame.

1. `detected`: A trigger predicate becomes true after its debounce threshold.
2. `raised`: A new active event is created with id, severity, category, phase, MET, body, vehicle, source, and trigger snapshot.
3. `updated`: The same condition changes details such as remaining time, altitude, reserve margin, or predicted miss distance.
4. `escalated`: Severity increases because the margin worsened or the mission phase changed.
5. `acknowledged`: The player dismisses the audible/visual attention demand, but the event remains active.
6. `cleared`: The clear predicate becomes true, such as a trim burn restoring the corridor.
7. `recovered`: The player selects an abort, alternate objective, or scenario branch that mitigates the event without restoring the original plan.
8. `failed`: The event becomes terminal for the active scenario, such as impact, hard landing, unrecoverable escape, or crew-loss entry.

An active event key should be stable across frames. A good default key is `failureId + activePhase + sourceObjectId`, with explicit overrides for repeated events such as multiple bad DSKY inputs or separate docking attempts.

## Event Log Behavior

The mission panel can continue to show the last few rows, but the failure system needs a full event buffer for review, scoring, and telemetry export.

### Log Format

Human-readable mission log rows should remain compact:

```text
012:34:56 WARN PE BELOW SURFACE
012:35:08 FAIL LUNAR IMPACT
012:40:11 INFO DSKY INPUT REJECTED
```

The structured event record should include:

- `id`: stable failure catalog id, or a runtime id for guardrail events.
- `instanceId`: unique raised event instance.
- `severity`: `info`, `caution`, `warning`, or `critical`.
- `prefix`: `INFO`, `CAUTION`, `WARN`, or `FAIL`.
- `category`: trigger category.
- `phase`: canonical mission/scenario phase at detection time.
- `met`: mission elapsed time in seconds.
- `body`: active primary body.
- `vehicle`: active vehicle mode.
- `headline`: short player-facing label.
- `detail`: one-sentence explanation of cause and consequence.
- `triggerSnapshot`: relevant values such as periapsis, propellant percent, delta-v error, range, rate, or entry angle.
- `recoveryActions`: available recovery affordance ids or labels.
- `state`: `raised`, `acknowledged`, `cleared`, `recovered`, or `failed`.

### De-Duplication And Escalation

- Do not append the same active warning every frame.
- Append a new row when a condition is first raised, changes severity, clears, recovers, or becomes terminal.
- Keep active unresolved caution/warning/critical events sticky in the UI even if they scroll out of the recent log.
- Use debounce thresholds from the failure definition when available; otherwise use category defaults.
- Re-raise a cleared event only if the condition returns after a cooldown or a new maneuver/attempt begins.

### Post-Failure Summary

Terminal failures should show a concise summary:

- Cause: `LUNAR IMPACT`, `NO PROP: SPS`, `ENTRY STEEP`, `DOCKING COLLISION`.
- Phase and MET.
- Last successful checkpoint.
- Primary values that crossed the limit.
- Recommended restart or recovery options.
- Recent related events, usually the last 3-5 warning rows.

## Recovery Affordances

Recovery options should be concrete commands or objectives, not generic advice. They should be filtered by phase, vehicle, body, propellant, scenario, and whether the state is still recoverable.

### Universal Affordances

- `ACK`: acknowledge the event and keep it listed as active.
- `OFF`: cancel mission-owned guidance and thrust.
- `HOLD`: enter a safe attitude hold when one is known.
- `RECOMPUTE`: update maneuver, rendezvous, landing, or entry prediction.
- `TRIM`: create or suggest a corrective maneuver node.
- `ABORT`: switch to a scenario-approved abort objective.
- `RETRY`: reset the current attempt, such as docking approach or landing gate.
- `CHECKPOINT`: restart from the latest valid checkpoint.
- `PAD`, `PARKING`, `LUNAR ORBIT`, `DESCENT START`, `ASCENT START`, `RENDEZVOUS`, `ENTRY`: named restart points when available.

### Category-Specific Examples

- Trajectory: create correction node, circularize, raise periapsis, lower apoapsis, restore free-return, target entry corridor.
- Burn/guidance: cut off engine, recompute node, align to maneuver vector, complete underburn, cancel stale node.
- Propulsion/resource: conserve RCS, disable nonessential maneuvers, choose lower-cost return, switch to LM propulsion in Apollo 13-style scenarios.
- Vehicle/phase: reject the command, show required previous step, switch to required vehicle mode only when safe.
- Landing: throttle down/up, hold surface retrograde, target nearest safe zone, abort to ascent stage.
- Docking/rendezvous: back out, null rates, hold station, retry approach, abort docking attempt.
- Entry: bias correction shallow/steep, hold entry attitude, prepare command module mode, accept degraded landing ellipse only if scenario rules allow it.

Critical events that are not terminal should default to recovery first, restart second. Terminal events should preserve the state for review and make restart/checkpoint controls obvious.

## Mission Phase Interactions

The same trigger can mean different things across the mission. Phase guards should prevent impossible actions before they create nonsense states, while failure predicates should catch hazards that emerge from valid play.

| Phase | Primary Failure/Warning Focus | Required Interactions |
| --- | --- | --- |
| Prelaunch | Invalid setup, launch not committed, reset/abort path. | Invalid mission burns are `info` or `caution` guardrails; no fuel or trajectory penalty. |
| Launch and ascent | Ground impact, bad pitch program, staging errors, suborbital insertion, high warp. | Critical launch hazards force `1x`; staging failures should name the current stage and leave `OFF`/reset available. |
| Earth parking orbit | Unsafe periapsis, low propellant margin, bad node setup, skipped checklist. | Warnings should suggest circularize, raise PE, or plan TLI only after orbit criteria are met. |
| TLI and early translunar coast | Underburn/overburn, missed lunar SOI, Earth reentry, escape without return plan. | Burn errors should generate correction affordances before becoming terminal trajectory failures. |
| Transposition and docking | Wrong vehicle configuration, unsafe closing rate, missed dock, collision. | Docking warnings should support back-out/retry loops, not immediate mission loss unless collision limits are exceeded. |
| Translunar coast and midcourse | Time-warp event stops, correction propellant, free-return margin, communications. | Warnings should stop warp before SOI, perilune, impact, or correction opportunity. |
| Lunar SOI and LOI | Lunar impact, failed capture, unstable orbit, LOI outside valid window. | LOI guardrails should require lunar context; capture failures should suggest retrograde/circularize correction while possible. |
| Lunar orbit and LM activation | CSM orbit validity, LM/CSM mode errors, descent prerequisites. | PDI should be refused until lunar orbit and LM descent conditions are satisfied. |
| Powered descent and landing | DPS fuel, vertical/horizontal speed, landing zone, abort altitude, hard landing. | Descent warnings should prioritize land now, throttle guidance, or abort to ascent stage. |
| LM ascent and rendezvous | Failed ascent orbit, missed CSM plane/phase, APS/RCS depletion, unsafe docking. | CSM target-state failures must be clear because rendezvous depends on inactive vehicle persistence. |
| TEI and transearth coast | TEI underburn/overburn, Earth-return miss, entry corridor, SPS reserve. | TEI warnings should distinguish fixable return targeting from insufficient propellant. |
| Entry and recovery | Shallow skip, steep heating/load, attitude error, blackout, splashdown classification. | Entry critical events may become terminal quickly; logs must preserve predicted angle, peak load, and corridor limits. |

Scenario phases should map onto canonical runtime phases instead of inventing unrelated names. For example, an Apollo 8 scenario can enable LOI and TEI failures without LM landing categories, while Apollo 11 enables descent, ascent, rendezvous, and docking categories.

## Trigger Evaluation Rules

Future implementation should evaluate failures in a small runtime owner, likely the scenario/objective engine or an `ApolloFailureSystem` owned by it. That owner should read state from `mission`, `scene`, `spacecraft`, maneuver nodes, scenario objectives, and optional standalone Apollo data.

Recommended evaluation cadence:

- Every frame for active burns, low-altitude hazards, docking contact, landing, and entry.
- At lower cadence for propellant reserves, communications, checklist state, and long-coast trajectory predictions.
- Immediately after commands, phase changes, vehicle switches, SOI transitions, node creation/clear, burn start/cutoff, landing/contact, and scenario checkpoint changes.

Recommended category defaults:

| Category | Default Debounce | Default Clear |
| --- | --- | --- |
| Trajectory and orbit | 1-3 seconds, except imminent impact is immediate. | Predicted orbit returns inside mission limits. |
| Burn and guidance | 0-1 seconds. | Burn completes/cancels and residual error is inside tolerance. |
| Propulsion and resources | 3-5 seconds for low reserves, immediate for depletion. | Plan reserve is recalculated below available resources, or scenario branch changes. |
| Vehicle configuration and guards | Immediate. | Valid command or required prerequisite is selected. |
| Collision, landing, docking | Immediate at contact limits. | Retry/back-out state begins, or terminal outcome is recorded. |
| Time warp and event stops | Immediate before event crossing. | Warp is reduced and the event is handled. |
| Crew interface and communications | Immediate for input, 3-10 seconds for signal/power trends. | Valid input, signal reacquisition, or expected blackout state. |

Trigger predicates should produce both a boolean and a margin. The margin drives escalation and recovery text: seconds to impact, meters below safe PE, propellant percent below reserve, delta-v error, range/rate excess, or entry angle error.

## Integration With Standalone `APOLLO_FAILURES`

`js/apolloFailures.js` is currently standalone browser data attached to `window.APOLLO_FAILURES`. It should be integrated later as a catalog, not as the runtime source of truth.

### Catalog Role

`APOLLO_FAILURES` should provide:

- Stable failure ids for saves, telemetry, scenario manifests, and log correlation.
- Default severity, title, systems, phase tags, trigger description, alert text, suggested thresholds, debounce hints, clear condition text, and recovery action labels.
- Human-readable documentation for planned event logic before every predicate has code.

The runtime should provide:

- Canonical phase mapping.
- Real predicate functions and measured margins.
- Active event lifecycle state.
- UI filtering and acknowledgement.
- Scenario-specific enable/disable rules.
- Concrete recovery commands and checkpoint availability.

### Phase Mapping

The catalog uses lower-case design phase tags such as `tli`, `loi`, `powered-descent`, and `lunar-orbit-rendezvous`. Runtime phases currently use labels such as `PRELAUNCH`, `PARKING`, `TLI BURN`, `LM DESCENT`, and `CSM ACTIVE`.

Integration should add a canonical phase registry:

- `prelaunch`
- `launch-ascent`
- `earth-parking-orbit`
- `tli`
- `transposition-docking-extraction`
- `translunar-coast`
- `course-correction`
- `lunar-soi`
- `loi`
- `lunar-orbit`
- `powered-descent`
- `terminal-descent`
- `surface-operations`
- `lm-ascent`
- `lunar-orbit-rendezvous`
- `tei`
- `transearth-coast`
- `entry-interface`
- `post-failure`

Both mission labels and scenario phase names should map to this registry. Catalog phase tags should be linted against it.

### Predicate Registry

Do not execute `trigger.eventLogic.condition` strings. Treat them as documentation until they are replaced by code.

Instead, add a predicate registry keyed by failure id or category:

```text
burn-overburn -> evaluateBurnDeltaVError(state, thresholds)
propellant-low-service-module -> evaluatePropellantReserve(state, thresholds)
docking-miss -> evaluateDockingLimits(state, thresholds)
entry-corridor-steep -> evaluateEntryCorridor(state, thresholds)
```

Each predicate should return:

- `active`: boolean.
- `severity`: computed severity, allowing phase/scenario escalation.
- `margin`: numeric or structured margin.
- `headline` and `detail`: player-facing text, defaulting to catalog alert text.
- `recoveryActionIds`: concrete actions available now.
- `clearActive`: boolean when an existing event should clear.

### Scenario Filtering

Scenario profiles should reference failure ids by name. The scenario/objective engine should decide which catalog events are enabled.

Examples:

- Apollo 8 enables TLI, LOI, TEI, lunar impact, missed capture, return corridor, and SPS reserve failures.
- Apollo 11 adds LM descent, ascent, rendezvous, docking, landing, and CSM target-state failures.
- Apollo 13 enables service-module emergency, SPS unavailable, LM lifeboat, free-return, consumables, and entry corridor failures.
- Tutorial scenarios may downgrade or suppress some failures until the lesson has introduced the relevant mechanic.

### Load Order And Validation

When integrated, `APOLLO_FAILURES` should be loaded before the scenario/failure system reads it. Because the current project is script-order driven, integration should be explicit in `index.html` or whichever future module loader owns Apollo data.

Validation should fail development checks when:

- A catalog id is duplicated.
- A severity is not one of `info`, `caution`, `warning`, or `critical`.
- A catalog phase tag is unknown.
- A recovery action cannot be mapped to text or a runtime command.
- A scenario references a missing failure id.
- A predicate watches a state path that has no runtime owner.

### Migration Steps

1. Add the catalog script to the load path only when a runtime consumer exists.
2. Create the canonical phase registry and phase-label mapping.
3. Add an `ApolloFailureSystem` or scenario-owned evaluator with event lifecycle state.
4. Register simple predicate functions for existing guardrails: no propellant, invalid phase command, PE below surface, stale node, and burn under/overrun.
5. Render active events in the mission panel without replacing the existing recent log.
6. Add checkpoint/restart affordances through the scenario framework.
7. Expand catalog-backed predicates for landing, docking, rendezvous, entry, and Apollo 13 resource scenarios.
8. Add automated checks for catalog validation, event de-duplication, escalation, clear/recovery, and time-warp stops.

## Acceptance Criteria

- Invalid commands are refused or logged with a clear cause and no silent state corruption.
- Active warnings de-duplicate, escalate, clear, and recover without log spam.
- Critical hazards force time warp to `1x` before the player loses a recoverable mission.
- Terminal failures preserve a useful post-failure state and offer restart/checkpoint options.
- Every scenario failure names the cause, phase, and violated limit.
- `APOLLO_FAILURES` remains a standalone versioned catalog until wired through a runtime evaluator.
- Tests cover at least no-propellant burn refusal, invalid command guards, PE-below-surface warning, stale node after SOI change, docking limit failure, landing classification, and entry corridor failure as those systems come online.
