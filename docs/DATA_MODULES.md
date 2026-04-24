# Apollo Data And Helper Modules

This document covers the standalone Apollo data/helper modules added for later mission, scenario, training, telemetry, rendezvous, and entry work. These files are intentionally separate from the current runtime wiring. They should be treated as data sources and pure helpers until a specific runtime owner consumes them.

The current app still loads only the core simulator scripts from `index.html`. The modules listed here are not part of that script chain yet.

## Loading Model

The project is currently browser-global and script-order driven. Until the app moves to a bundler or native ES modules, load these files with `<script>` tags and read their globals from `window`.

Recommended script placement when integrating them later:

```html
<script src="js/apolloConstants.js"></script>
<script src="js/apolloProfiles.js"></script>
<script src="js/apolloFailures.js"></script>
<script src="js/apolloChecklists.js"></script>
<script src="js/apolloLessons.js"></script>
<script src="js/apolloTelemetryRecorder.js"></script>
<script src="js/apolloRendezvousPlanner.js"></script>
<script src="js/apolloEntryGuidance.js"></script>
```

Place data/helper scripts after shared low-level utilities if the loader wants all globals present, but before any future scenario, objective, mission-panel, training, or scoring runtime that consumes them. They do not need to be loaded before `js/mission.js` today because `ApolloMission` does not depend on them yet.

If these become ES modules later, keep the same conceptual order:

1. Reference constants.
2. Scenario/profile/checklist/failure/lesson catalogs.
3. Stateless planning and scoring helpers.
4. Runtime owners that consume the catalogs/helpers.

## Module Catalog

| File | Global | Type | Main Contents | Runtime Role |
| --- | --- | --- | --- | --- |
| `js/apolloConstants.js` | `window.APOLLO_CONSTANTS` | Data catalog | Earth/Moon constants, Saturn V, CSM, LM, delta-v bands, display thresholds, common altitudes | Shared reference source for mission setup, UI labels, validation thresholds, and later burn planning |
| `js/apolloProfiles.js` | `window.APOLLO_PROFILES` | Data catalog | Apollo 8/11/13-style scenarios, phase checklists, burn presets, vehicles, profile failures, timeline events | Scenario/objective source of truth once the mission layer stops hard-coding phase behavior |
| `js/apolloFailures.js` | `window.APOLLO_FAILURES` | Data catalog | Failure schema, severity levels, detailed trigger metadata, alerts, recovery actions | Failure engine and mission-panel warning metadata |
| `js/apolloChecklists.js` | `window.APOLLO_CHECKLISTS` | Data catalog | Phase order, detailed checklist steps, trigger hints, success criteria, caution criteria | Checklist UI and objective gating |
| `js/apolloLessons.js` | `window.APOLLO_LESSONS` | Data catalog | Training tracks, lesson objectives, success checks, hints | Flight school/training progression and contextual coaching |
| `js/apolloTelemetryRecorder.js` | `window.ApolloTelemetryRecorder` | Helper class | Rolling samples, min/max snapshots, CSV export, tolerant state readers | Runtime-owned telemetry capture for scoring, debugging, event logs, and post-failure summaries |
| `js/apolloRendezvousPlanner.js` | `window.ApolloRendezvousPlanner` | Pure helper object | Phase-angle estimates, relative-motion summaries, coelliptic altitude suggestions, TPI readiness | Rendezvous UI and objective guidance once separate LM/CSM state vectors exist |
| `js/apolloEntryGuidance.js` | `window.ApolloEntryGuidance` | Frozen helper/data object | Entry corridor bands, heating/g-load bins, splashdown scoring, guidance cues, entry briefs | Entry UI and scoring once command-module mode, entry prediction, and splashdown estimation exist |

## Data Modules

### `APOLLO_CONSTANTS`

`APOLLO_CONSTANTS` is the shared reference catalog. It uses SI units unless a field name says otherwise. It includes:

- Earth and Moon physical values, atmosphere/orbit references, and SOI radii.
- Saturn V, CSM, and LM mass/thrust/vehicle reference values.
- Mission delta-v bands for launch, TLI, LOI, descent, ascent, rendezvous, TEI, and entry trim.
- Display thresholds and common mission altitudes.

Boundary rule: consume constants through a small adapter or selector in the owning runtime. Do not let UI code mutate these values or treat them as active mission state.

Load priority: first among Apollo modules. Later data catalogs can be validated against it, even though they do not currently read it directly.

### `APOLLO_PROFILES`

`APOLLO_PROFILES` is the scenario and mission-profile catalog. It includes:

- Scenario entries for Apollo 8 lunar orbit, Apollo 11 lunar landing, and Apollo 13-style free return.
- Phase metadata and compact phase checklists.
- Burn presets with body, vehicle mode, engine, attitude mode, delta-v, duration, and notes.
- Vehicle reference entries for `saturn-v`, `s-ivb`, `csm-lm`, `csm`, `cm`, `lm-descent`, and `lm-ascent`.
- Profile-level failure effects and timeline events.

Boundary rule: profiles describe desired scenario behavior. They should not execute burns, switch vehicles, mutate mission phase, or write DOM. A future scenario/objective engine should translate profile data into runtime commands and validation checks.

Load priority: after constants and before consumers such as mission selection, objective tracking, scoring, and mission-panel snapshots.

### `APOLLO_FAILURES`

`APOLLO_FAILURES` is the detailed failure catalog. It includes:

- Stable failure IDs for saves, logs, and warnings.
- Severity levels from advisory through critical.
- Systems, mission phases, human-readable trigger descriptions, structured event-logic hints, alerts, and recovery actions.

Boundary rule: this catalog is metadata only. A future failure engine owns trigger evaluation, debouncing, activation, clearing, and recovery state. The mission panel may render alerts and recovery actions from the catalog, but it should not infer hidden simulation state from catalog text.

Load priority: before warning/event-log UI and before any failure engine that resolves profile failure IDs into detailed metadata.

### `APOLLO_CHECKLISTS`

`APOLLO_CHECKLISTS` is the detailed checklist catalog. It includes:

- Phase order for a KSP-like Apollo lunar landing flow.
- Per-phase objectives, trigger hints, success criteria, checklist steps, and caution criteria.
- Descriptive rules that can be progressively automated as telemetry becomes available.

Boundary rule: checklist state belongs to a runtime owner. The catalog provides text and criteria, but `TODO`, `ACTIVE`, `DONE`, `SKIP`, and `BLOCKED` state should live in mission/session state, not in the catalog.

Load priority: before the checklist panel and objective engine. It can be loaded independently from profiles, but integration should map profile phase IDs to checklist phase IDs through a small adapter.

### `APOLLO_LESSONS`

`APOLLO_LESSONS` is the training catalog. It includes:

- `orbital-flight-school` lessons for orbit basics, attitude markers, circularization, and maneuver nodes.
- `apollo-mission-school` lessons for Saturn V staging, TLI, rendezvous, entry, and other Apollo tasks.
- Objectives, success checks, and hints for future tutorial progression.

Boundary rule: lessons should not depend on live mission internals directly. A training runtime should map lesson `scenario` IDs and `successChecks` onto simulator state through explicit adapters.

Load priority: before a future flight-school/training menu. It does not need to be loaded for normal free-flight Apollo gameplay unless contextual coaching is enabled.

## Helper Modules

### `ApolloTelemetryRecorder`

`ApolloTelemetryRecorder` is a class, not a singleton. Runtime code should instantiate it where telemetry is owned:

```js
const recorder = new window.ApolloTelemetryRecorder({ maxSamples: 600 });
recorder.record(scene, mission, spacecraft);
```

It records tolerant samples from `scene`, `mission`, and `spacecraft`, including mission time, phase, body, vehicle, altitude, velocity, fuel, SPS fuel, RCS fuel, mass, time warp, thrust, and RCS activity. It maintains a rolling buffer, min/max snapshots for altitude/velocity/fuel, and CSV export helpers.

Boundary rule: the recorder reads runtime objects but does not own them. It should never advance mission time, change vehicle state, command thrust, or mutate scene objects. The only optional global it reads is `root.scaleManager` for display-to-real-world conversion.

Load priority: before scoring, event-export, regression-capture, or mission-panel snapshot code that creates a recorder instance. It can be loaded late as long as callers guard against a missing global.

### `ApolloRendezvousPlanner`

`ApolloRendezvousPlanner` is a pure helper object. It exposes:

- `phaseAngleEstimate` / `estimatePhaseAngle`.
- `relativeMotionSummary` / `summarizeRelativeMotion`.
- `coellipticAltitudeSuggestion` / `suggestCoellipticAltitude`.
- `terminalPhaseInitiationHeuristic` / `assessTerminalPhaseInitiation`.

The helper assumes simple circular, coplanar orbit approximations unless the caller provides more specific values. Public distances are meters, time is seconds, and public angle inputs are degrees unless a property name ends in `Rad`.

Boundary rule: the planner can recommend phase, altitude, and readiness values, but it must not create maneuver nodes, fire RCS, dock vehicles, or decide mission success. Rendezvous runtime code must own target state vectors, range/range-rate telemetry, node creation, docking checks, and event logging.

Load priority: after constants if callers want to pass Moon radius/mu from `APOLLO_CONSTANTS`; otherwise it is independent. Do not wire it into UI until LM and CSM can exist as separate active/inactive state vectors.

### `ApolloEntryGuidance`

`ApolloEntryGuidance` is a frozen helper/data object. It exposes:

- Entry target defaults and splashdown target defaults.
- Corridor, heating, g-load, and splashdown bands.
- `classifyEntryCorridor`.
- `estimateEntryLoads`.
- `classifyHeating`.
- `classifyGLoad`.
- `scoreSplashdown`.
- `getGuidanceCues`.
- `buildEntryBrief`.

The helper is qualitative and gameplay-oriented. It classifies a predicted command-module entry, estimates heating/g-load risk, scores splashdown distance or coordinates, and returns guidance cues for the UI.

Boundary rule: entry guidance should only score/present a predicted entry solution supplied by an entry runtime. It should not own atmosphere physics, command-module separation, bank control, parachute deployment, splashdown simulation, or recovery events.

Load priority: before entry UI/scoring. Runtime integration should wait until `cm` is a first-class vehicle mode and the sim can predict entry interface, flight path angle, landing footprint, and service-module separation state.

## Dependency Boundaries

Keep these modules on the data/helper side of the architecture:

- No module in this set should mutate `Scene`, `Spacecraft`, `ApolloMission`, DOM state, input handlers, or maneuver-node internals as a side effect of loading.
- Data catalogs should attach one stable global and otherwise be inert.
- Helper modules may compute derived values from caller input, but runtime owners decide when those values become warnings, objectives, commands, or score.
- Use SI units at module boundaries unless a field name explicitly says otherwise.
- Treat `version` and `schema` fields as compatibility hooks for save files, tests, and future migrations.
- Keep active session state outside the catalogs: selected scenario, checklist progress, active failures, event logs, lesson progress, telemetry buffers, rendezvous target state, and entry predictions all belong to runtime owners.
- If a module is absent, consuming UI should degrade to live mission telemetry and log a non-fatal informational event instead of blocking flight.

## Suggested Integration Order

1. Add a loader step for the inert data catalogs: `APOLLO_CONSTANTS`, `APOLLO_PROFILES`, `APOLLO_FAILURES`, `APOLLO_CHECKLISTS`, and `APOLLO_LESSONS`. Smoke-test that each global exists and exposes the expected `version`.
2. Add a small Apollo data adapter that normalizes profile IDs, phase IDs, vehicle IDs, burn IDs, and failure IDs. The adapter should be the only place that cross-links the catalogs.
3. Wire `APOLLO_CONSTANTS` into read-only UI/reference displays first, then gradually promote constants into mission setup and vehicle tuning with regression checks against current gameplay.
4. Use `APOLLO_PROFILES` to drive scenario selection, phase labels, objective order, recommended burns, and timeline callouts. Keep actual phase advancement in mission state.
5. Add checklist runtime state backed by `APOLLO_CHECKLISTS`. Start with manual step completion, then automate success criteria only where telemetry can prove them.
6. Add warning/event-log metadata from `APOLLO_FAILURES`. Evaluate actual triggers in a dedicated failure engine and render catalog alerts/recovery actions through the mission panel.
7. Add `ApolloTelemetryRecorder` as a mission-owned service. Use it for event export, min/max summaries, scenario scoring, and regression captures before connecting it to user-facing scoring.
8. Use `APOLLO_LESSONS` for a flight-school menu and contextual hints after scenario selection and checklist state are stable.
9. Integrate `ApolloRendezvousPlanner` after inactive CSM/LM state vectors, target selection, range/range-rate telemetry, and docking gates exist.
10. Integrate `ApolloEntryGuidance` after `cm` mode, service-module separation, entry-interface prediction, command-module attitude, splashdown prediction, and recovery scoring exist.
11. Replace fixed Apollo burns with maneuver-node generation only after the data modules are read through adapters and mission/node ownership rules are enforced.

## Cross-Linking Rules

Use stable IDs, not display labels, when connecting modules:

- Scenario `objectivePhaseIds` and `phaseChecklists` should map to checklist `phaseOrder`/`phases`.
- Profile `recommendedBurnIds` should map to `APOLLO_PROFILES.burnPresets`.
- Profile `enabledFailureIds` may map to either profile-level `failures` or detailed `APOLLO_FAILURES.failures`; the adapter should handle missing detailed entries gracefully.
- Vehicle modes should map to runtime `Spacecraft.vehicleMode` only through explicit mission code, not by letting data modules call vehicle methods.
- Entry and rendezvous helpers should consume computed telemetry snapshots rather than reading live globals directly.

## Test And Verification Notes

When these modules are loaded later, add lightweight checks before deeper gameplay work:

- Every expected global exists after script loading.
- Catalog `version` values are present.
- Required IDs referenced by profiles resolve through the adapter.
- Telemetry recorder can record, clone, clear, and export CSV without mutating the source objects.
- Rendezvous planner outputs finite values for nominal LM/CSM lunar orbit inputs.
- Entry guidance classifies shallow, target, steep, and splashdown cases with stable IDs.

