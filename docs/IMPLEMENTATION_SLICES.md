# Implementation Slices

This plan breaks the Apollo/KSP game effort into atomic commits or PRs. Each slice should leave the simulator runnable from `index.html`, keep gameplay in a coherent state, and avoid mixing unrelated ownership areas.

## Current Source Ownership

- Browser shell and UI styling: `index.html`, `style.css`.
- Core simulation: `js/scaleManager.js`, `js/physics.js`, `js/planet.js`, `js/spacecraft.js`.
- Scene, input, map, node editor, trajectory rendering, time warp, and maneuver execution: `js/scene.js`.
- Apollo mission state, Moon/SOI context, mission panel, launch guidance, fixed mission burns, vehicle mode commands, and mission logging: `js/mission.js`.
- Apollo data and gameplay references: `js/apolloConstants.js`, `js/apolloProfiles.js`, `js/apolloChecklists.js`, `js/apolloLessons.js`, `js/apolloFailures.js`.
- Focused helper modules: `js/apolloRendezvousPlanner.js`, `js/apolloEntryGuidance.js`, `js/apolloTelemetryRecorder.js`.
- Lightweight verification: `js/mission-sim-check.js`, plus manual browser checks because there is no build system or test runner.

## Maneuver-Node Conflict Boundaries

The maneuver-node code is the highest-conflict area. Treat these boundaries as hard PR ownership rules.

- `js/scene.js` owns `this.maneuver`, `#node-editor`, node keyboard/mouse input, AP/PE/node labels, predicted trajectory rendering, maneuver-vector attitude alignment, auto-burn timing, and main-engine cutoff for node burns.
- `js/mission.js` owns mission intent: phase validation, TLI/LOI/PDI/TEI requests, high-level assist state, body/SOI context, mission log messages, and mission-panel warnings.
- Mission assists should not mutate `scene.maneuver.*` directly. Add a narrow scene API first, then have mission code call it. Suggested API shape: `planManeuverFromMission({ label, nodeTime, progradeDV, normalDV, radialDV, body, source })`, `armManeuverBurn(source)`, `clearManeuverSource(source)`.
- Scene/node code should not decide Apollo phase progression. It may emit completion/failure facts such as burn delivered delta-v, propellant exhaustion, node cleared, or predicted conic invalid; `ApolloMission` decides what that means.
- Only one owner may command thrust or attitude at a time. Use explicit owners such as `manual`, `manual-node`, `mission-burn`, `launch-guidance`, `descent-guidance`, and `rendezvous-guidance`.
- Manual thrust, manual attitude keys, `OFF`, `STAGE`, and node edits must cancel incompatible auto-burn or mission-burn ownership predictably.
- Avoid combining PRs that touch both `Scene` node internals and `ApolloMission.startFixedBurn()`/mission burn logic unless the PR is specifically the node API handoff slice.

## Slices

### 01. Load Apollo Data Modules

- Source ownership: `index.html` script order; read-only use of existing Apollo data modules.
- Dependencies: none.
- Risk: globals are browser-loaded by script order, so adding data scripts before their consumers can create undefined references if the order is wrong.
- Verification: open `index.html` or run `python -m http.server 8000`; browser console has `window.APOLLO_CONSTANTS`, `window.APOLLO_PROFILES`, `window.APOLLO_CHECKLISTS`, `window.APOLLO_FAILURES`; existing orbit startup still renders.

### 02. Assist Ownership And Cancellation Contract

- Source ownership: `js/mission.js` for mission assist state; `js/scene.js` only for exposing current node/manual assist ownership; `style.css` only if adding an owner annunciator.
- Dependencies: none, but best before changing burns.
- Risk: thrust can be left on or SAS can fight a mission/vector hold if cancellation is incomplete.
- Verification: manual `PRO`, `RET`, `TLI`, node `ALIGN`, node `BURN`, `OFF`, `Space`, and `STAGE` interactions; verify only one guidance label is active and thrust stops on cancellation; run `node js/mission-sim-check.js`.

### 03. Mission Phase Guards And Warnings

- Source ownership: `js/mission.js` command validation and log messages; optional read-only constants from `js/apolloChecklists.js` or `js/apolloProfiles.js`.
- Dependencies: slice 02.
- Risk: over-strict guards can block useful sandbox shortcuts such as `ORBIT`, while loose guards still allow impossible Apollo states.
- Verification: try invalid command sequences (`PDI` in Earth orbit, `TEI` while LM active, `LOI` outside lunar SOI, `STAGE` after Saturn V separation); expected result is a warning/log with no silent state teleport.

### 04. Public Maneuver Planning API

- Source ownership: `js/scene.js` owns the API and keeps all node data internal; `js/mission.js` may call the API but should not change node internals.
- Dependencies: slice 02.
- Risk: this is the key conflict boundary; poor API design will force later mission PRs back into direct `this.maneuver` mutation.
- Verification: existing manual node controls still work; a small console or temporary mission call can create/clear a node without touching `scene.maneuver` externally; node prediction, alignment, burn, and clear behavior remain unchanged.

### 05. Mission Burns Generate Editable Nodes

- Source ownership: `js/mission.js` computes TLI/LOI/PDI/TEI/CIRC burn intent; `js/scene.js` executes through the public node API only.
- Dependencies: slices 02 and 04.
- Risk: fixed burns currently spend propellant immediately; replacing them with nodes changes timing and player expectations.
- Verification: pressing `TLI`, `LOI`, `PDI`, `TEI`, or `CIRC` creates an editable node with correct label, vector, TIG, predicted AP/PE, burn duration, and fuel cost; `BURN` spends propellant through the existing main-engine path.

### 06. Burn Timing And Warp Event Stops

- Source ownership: `js/scene.js` for node ignition timing and warp stops; `js/mission.js` for SOI/periapsis/mission-critical event facts.
- Dependencies: slices 04 and 05.
- Risk: time warp can skip ignition, SOI changes, low-altitude hazards, or impact checks if event prediction is too sparse.
- Verification: arm a node several minutes ahead at high warp; warp drops before `TIG - burnDuration / 2`; translunar coast drops before lunar SOI; low perilune/perigee cases drop before impact or atmosphere.

### 07. Mission Objective Predicate Engine

- Source ownership: new or existing data helpers for objective predicates; `js/mission.js` owns runtime objective state; `js/apolloProfiles.js` and `js/apolloChecklists.js` provide data.
- Dependencies: slices 01 and 03.
- Risk: predicates can become a second mission state machine if they mutate sim state.
- Verification: parking-orbit, TLI, lunar SOI, LOI capture, landing, rendezvous, TEI, and entry objectives can be evaluated as pass/fail/active from current telemetry without changing vehicle state.

### 08. Checklist And Objective UI

- Source ownership: `js/mission.js` mission-panel rendering; `style.css` panel layout; data from `js/apolloChecklists.js`.
- Dependencies: slice 07.
- Risk: the mission panel can become too crowded and hide existing node/map readouts.
- Verification: current phase, active objective, next unlock condition, and warning cause render at desktop and narrow widths; existing maneuver editor remains usable.

### 09. Failure Cause Classifier

- Source ownership: `js/mission.js` for runtime detection and log integration; `js/apolloFailures.js` for failure definitions; optional `js/apolloTelemetryRecorder.js` for samples.
- Dependencies: slices 03 and 07.
- Risk: noisy failure detection will punish exploratory play; missing debounce can spam logs.
- Verification: force representative states for no propellant, unsafe periapsis, missed SOI, lunar impact, hard landing, docking miss, and entry corridor miss; each produces one actionable cause label and recovery path.

### 10. Checkpoints And Restart Controls

- Source ownership: `js/mission.js` checkpoint capture/load; `js/spacecraft.js` only if vehicle state serialization needs a narrow helper; `style.css` for restart controls.
- Dependencies: slices 07 through 09.
- Risk: incomplete checkpoint state can revive the wrong vehicle mode, propellant, primary body, or maneuver state.
- Verification: load pad, parking orbit, translunar coast, lunar orbit, descent start, surface/ascent, rendezvous, and TEI checkpoints; confirm body, vehicle, fuel, velocity, phase, objective, and active assists are coherent.

### 11. Saturn V Ascent To Real Parking Orbit

- Source ownership: `js/mission.js` launch guidance and phase transitions; `js/spacecraft.js` only for Saturn V stage data/vehicle behavior; `js/physics.js` only for reusable math fixes.
- Dependencies: slices 03 and 07.
- Risk: ascent is currently a gameplay convenience, not atmosphere/drag guidance; tuning can overfit a single launch path.
- Verification: from `LAUNCH`, auto-staging reaches a stable roughly 185 km Earth parking orbit or fails with a clear cause; `ORBIT` shortcut remains available for sandbox starts.

### 12. Patched-Conic SOI Continuity

- Source ownership: `js/mission.js` SOI transition handling; `js/physics.js` for conic/state math; `js/mission-sim-check.js` for continuity checks.
- Dependencies: slices 06 and 07.
- Risk: discontinuities at Moon SOI can create velocity jumps, wrong relative energy, or stale node predictions.
- Verification: add checker cases for Earth-to-Moon and Moon-to-Earth patching; manual TLI coast shows no visible teleport or energy spike; node prediction is cleared or re-based when primary body changes.

### 13. Apollo 8 End-To-End Mission

- Source ownership: `js/apolloProfiles.js` scenario data; `js/mission.js` objective sequencing; `js/apolloEntryGuidance.js` only for return-corridor placeholder/readout.
- Dependencies: slices 05 through 12.
- Risk: Apollo 8 can become too much at once if landing/rendezvous pieces leak in.
- Verification: complete parking orbit -> TLI -> lunar SOI -> LOI -> lunar orbit -> TEI -> Earth return corridor from checkpoints; failure catches missed capture, lunar impact, no SPS reserve, and unsafe return.

### 14. Separate CSM/LM Vessel State

- Source ownership: `js/mission.js` active/inactive vehicle registry; `js/spacecraft.js` for vehicle mode/state serialization helpers; `js/scene.js` only for rendering or selecting secondary target markers.
- Dependencies: slices 07 and 10.
- Risk: duplicating spacecraft state can desync mass, propellant, attitude, or primary-body frame between active and inactive vessels.
- Verification: undock LM in lunar orbit, switch active vehicles, preserve CSM orbit while LM maneuvers, restore CSM as active without losing its orbit or propellant.

### 15. Transposition And Docking Lite

- Source ownership: `js/mission.js` transposition objective and capture state; `js/scene.js` target marker and range/rate readouts; `js/spacecraft.js` RCS behavior only if needed.
- Dependencies: slices 08 and 14.
- Risk: full collision/contact physics is out of scope; the first version should be a guided docking box with clear tolerances.
- Verification: CSM separates, turns around, translates with RCS, enters capture range below closing-speed/alignment limits, and returns to docked CSM+LM state; unsafe contact produces docking failure.

### 16. Lunar Surface And Landing Classification

- Source ownership: `js/mission.js` landing state and failure labels; `js/physics.js` collision/altitude helpers; `js/planet.js` only if lunar surface radius/terrain hooks are needed.
- Dependencies: slices 07 through 09 and 14.
- Risk: simple spherical terrain can feel unfair if visual touchdown and classified altitude disagree.
- Verification: LM descent impact, hard landing, safe landing, and low-altitude flyover cases classify by altitude, vertical speed, horizontal speed, and vehicle mode.

### 17. LM Descent Telemetry And Throttleable DPS

- Source ownership: `js/spacecraft.js` LM descent engine throttle/fuel behavior; `js/mission.js` descent guidance/readouts; `style.css` panel readouts.
- Dependencies: slice 16.
- Risk: adding throttle can break existing main-engine assumptions used by CSM/SPS and node burn timing.
- Verification: LM shows radar altitude, vertical speed, horizontal speed, site range, throttle, DPS fuel, and abort margin; throttle changes affect acceleration and fuel consumption without breaking SPS burns.

### 18. LM Ascent And Rendezvous Planning

- Source ownership: `js/apolloRendezvousPlanner.js` pure planning helpers; `js/mission.js` ascent/rendezvous objectives and CSM target use; `js/scene.js` relative markers/readouts.
- Dependencies: slices 14 and 16.
- Risk: rendezvous helpers assume simple circular/coplanar motion, so UI must present them as guidance aids, not guaranteed solutions.
- Verification: from surface/ascent checkpoint, launch LM ascent, achieve lunar orbit, show phase/range/range-rate/closest approach, and create correction nodes without direct node-state mutation.

### 19. RCS Proximity Operations And Docking Capture

- Source ownership: `js/scene.js` docking reticle/range-rate display; `js/mission.js` capture/failure state; `js/spacecraft.js` RCS translation feedback and propellant accounting.
- Dependencies: slices 15 and 18.
- Risk: final approach can become twitchy unless rates and tolerances are visible and forgiving.
- Verification: docking requires range, closing rate, alignment, and lateral offset inside limits; collision/overspeed fails; backing out and retrying works; RCS propellant depletion is handled.

### 20. Apollo 11 Scenario Integration

- Source ownership: `js/apolloProfiles.js` Apollo 11 scenario; `js/mission.js` objective chain and checkpoints; UI/data files only for score bands and lesson hooks.
- Dependencies: slices 13 through 19.
- Risk: this slice can sprawl; it should mostly connect already-implemented launch, transfer, landing, ascent, rendezvous, TEI, and entry pieces.
- Verification: complete Apollo 11 from parking-orbit and major checkpoints; success requires safe landing, ascent, docking, TEI, and return corridor; failure/restart works at descent, surface, ascent, rendezvous, and TEI.

### 21. Entry Corridor And Splashdown Challenge

- Source ownership: `js/apolloEntryGuidance.js` entry model; `js/mission.js` entry objective/failure integration; `js/scene.js` only if adding map/splashdown markers.
- Dependencies: slices 09, 10, and 13.
- Risk: entry physics can balloon into a full atmosphere sim; keep it a readable corridor predictor and classification layer first.
- Verification: shallow, nominal, steep, and impact return states classify consistently; correction burns update predicted interface angle and splashdown score; Apollo 8/11 return objectives consume the same classifier.

### 22. Apollo 13 Free-Return Contingency

- Source ownership: `js/apolloProfiles.js` scenario data; `js/apolloFailures.js` failure/event definitions; `js/mission.js` contingency vehicle/resource rules; `js/apolloEntryGuidance.js` return corridor.
- Dependencies: slices 13 and 21; optional dependency on slice 17 for LM DPS corrections.
- Risk: resource simulation can drift into full spacecraft systems; keep the first pass to propulsion availability, consumable bands, and objective consequences.
- Verification: start post-TLI with SPS disabled, use LM-lifeboat constraints, perform free-return/PC+2-style correction, reconfigure for entry, and fail cleanly on missed free-return, depleted LM propellant, invalid configuration, or unsafe entry.

## Review Checklist For Every PR

- The PR has one gameplay outcome and one ownership area, or clearly introduces a narrow API between two areas.
- The simulator still starts by opening `index.html`.
- `node js/mission-sim-check.js` passes unless the PR explicitly updates that checker.
- Manual verification steps are listed in the PR description with exact controls used.
- Mission assists, maneuver nodes, manual thrust, and time warp have a stated cancellation/ownership result.
- New failure states name the cause and leave a useful restart, recovery, or correction path.
