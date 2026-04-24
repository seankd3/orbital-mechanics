# Apollo Architecture Notes

This note documents the current Apollo game architecture as an engineer-facing map. It is intentionally about ownership boundaries and integration rules, not a gameplay spec. For phase goals and operator behavior, see `docs/APOLLO_GAMEPLAY.md` and `docs/CONTROL_MAP.md`.

## Runtime Shape

- `index.html` loads the core browser globals in order: scale/physics/body/vehicle/rendering modules, then `js/mission.js`, then `js/main.js`.
- `js/main.js` creates `ScaleManager`, `Scene`, Earth, and one `Spacecraft`. If `window.ApolloMission` exists, it constructs `new ApolloMission(scene, spacecraft, earth, scaleManager)`.
- `js/scene.js` owns the primary frame loop, rendering, input, map camera, HUD updates, time warp, orbit drawing, and the maneuver-node editor/executor.
- `js/spacecraft.js` owns active vehicle performance, mesh swapping, propellant pools, thrust/RCS application, SAS state, and vehicle labels.
- `js/mission.js` is the Apollo mission layer. It adds the Moon, mission panel, phase state, simplified guidance, launch staging flow, fixed mission burns, and Earth/Moon primary-body switching.
- Shared support modules stay small and global: `physics`, `ScaleManager`, `Planet`, `Navball`, `AudioEngine`, and `STAR_CATALOG`.

The current runtime is browser-global and script-order driven. New Apollo integrations should respect that until the project moves to modules/build tooling.

## Mission Layer Hooks

`ApolloMission` installs two `Scene` prototype hooks from `js/mission.js`:

- `Scene.prototype.updatePhysics` is wrapped once, guarded by `window.__apolloMissionHooksInstalled`.
- `mission.prePhysics(deltaTime)` runs before scene physics. It advances mission elapsed time, updates Earth/Moon motion, switches the active primary body at lunar SOI, clamps warp in lunar SOI, and applies mission guidance.
- The original scene physics then runs as normal.
- `mission.postPhysics(deltaTime)` runs after physics. It tracks mission-burn delta-v from propellant mass change and refreshes mission telemetry.
- `Scene.prototype.calculateOrbitalParameters` is wrapped so Apollo mode computes orbits relative to the active primary body's position and velocity.

Keep these hooks thin. They are for mission context and body-relative state, not for replacing the scene loop.

## Vehicle Modes

`Spacecraft.vehicleMode` is the active-vehicle contract used by the mission panel, telemetry, and vehicle performance:

- `saturn-v`: launch stack using `launchStages` and `currentStageIndex` for S-IC, S-II, and S-IVB. `separateStage()` advances stages and eventually switches to `csm-lm`.
- `csm-lm`: docked CSM+LM stack using CSM SPS thrust with docked mass.
- `csm`: standalone command/service module.
- `lm-descent`: LM descent-stage configuration using DPS-like thrust and LM RCS reserves.
- `lm-ascent`: LM ascent-stage configuration using APS-like thrust and reduced RCS reserves.
- `cm`: referenced by profile data as a future entry configuration, but not a first-class runtime mode yet.

Mode switches currently swap mass, thrust, propellant limits, mesh, and label on a single active spacecraft. They are gameplay abstractions, not physical separations. Future rendezvous, landing, and entry work will need explicit inactive state vectors for CSM, LM descent/ascent, command module, target vehicles, and discarded stages.

## Standalone Apollo Data

Several Apollo files are intentionally standalone browser data or pure helpers. They should remain load-order tolerant, versioned, SI-unit based unless a field says otherwise, and free of runtime side effects beyond attaching one global.

- `js/apolloConstants.js`: shared reference constants and rough mission delta-v bands.
- `js/apolloChecklists.js`: phase checklists, trigger hints, and success criteria.
- `js/apolloProfiles.js`: Apollo 8/11/13-style scenarios, phase metadata, recommended burns, vehicles, failures, and timeline events.
- `js/apolloFailures.js`: failure catalog with severities, trigger descriptions, alerts, and recovery actions.
- `js/apolloLessons.js`: tutorial tracks, lesson objectives, checks, and hints.
- `js/apolloRendezvousPlanner.js`: pure rendezvous planning heuristics for phase angle, relative motion, coelliptic altitude, and TPI readiness.
- `js/apolloTelemetryRecorder.js`: runtime sampler/export helper that reads `scene`, `mission`, and `spacecraft` without owning them.
- `js/apolloEntryGuidance.js`: emerging entry-corridor guidance data/helper module; keep it isolated until entry gameplay has a runtime owner.

These modules are not all loaded by `index.html` today. Treat them as data sources for future scenario/objective systems, not as implicit runtime state.

## Future Integration Points

- Replace fixed mission burns (`TLI`, `LOI`, `PDI`, `TEI`) with generated maneuver nodes that the existing node executor can fly.
- Add a scenario/objective engine that consumes `APOLLO_PROFILES`, `APOLLO_CHECKLISTS`, `APOLLO_FAILURES`, and `APOLLO_LESSONS` instead of hard-coding phase UI behavior.
- Promote constants from `APOLLO_CONSTANTS` into mission and vehicle setup gradually, with regression checks for current gameplay numbers.
- Add explicit event-stop logic for time warp before maneuver ignition, SOI switch, periapsis, low-altitude hazards, landing, docking, and entry interface.
- Split active/inactive vehicle state so LM undock, descent, ascent, CSM target persistence, docking, and jettison can become real gameplay.
- Wire `ApolloRendezvousPlanner` into rendezvous UI only after the runtime has target state vectors and range/range-rate telemetry.
- Wire entry guidance after `cm` mode, entry interface prediction, atmosphere/corridor approximation, and splashdown classification exist.
- Use `ApolloTelemetryRecorder` for scenario scoring, post-failure summaries, and regression captures.
- Extend `js/mission-sim-check.js` or add focused checks for SOI continuity, mission delta-v estimates, and node-generated mission burns.

## Maneuver-Node Conflict Rules

The maneuver-node system belongs to `Scene`, not `ApolloMission`.

- Do not rewrite or fork `scene.maneuver`, node editor DOM IDs, node prediction, auto-align, or auto-burn logic from the mission layer.
- Mission assists should call narrow `Scene` methods when they need node behavior. If a needed method does not exist, add an explicit adapter on `Scene` rather than mutating maneuver internals from `ApolloMission`.
- Only one owner may command main-engine thrust or attitude at a time: manual input, mission guidance, or maneuver execution. Starting one must cancel, refuse, or clearly supersede incompatible owners.
- `OFF`, manual thrust, staging, and vehicle switches must stop mission-owned burns and should not leave node auto-burn armed accidentally.
- A mission burn should not run while `scene.maneuver.burnActive` is true. A generated mission node should hand execution to the node executor and then get out of the way.
- Primary-body/SOI changes must clear or recompute node predictions, because node vectors and conics are local to the active body.
- Mission UI may display node status, but `Scene` remains the source of truth for node delta-v, TIG, predicted AP/PE, alignment error, and burn timing.
- Keep prototype hooks idempotent and minimal. Any broader coordination with maneuver nodes should be an explicit shared API, not another wrapper around the scene loop.
