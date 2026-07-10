# Apollo/KSP Slice Release Notes

## Summary

This slice moves the simulator toward a KSP-style Apollo mission loop: staged launch, compact mission-control UI, explicit vehicle configurations, Moon transfer/capture flow, and a growing set of Apollo data modules for future scenario, checklist, failure, rendezvous, and entry work.

## Highlights

- Added Apollo vehicle modes for the Saturn V launch stack, docked CSM+LM, standalone CSM, LM descent stage, and LM ascent stage.
- Added Saturn V staging behavior with S-IC, S-II, and S-IVB performance profiles, plus manual and guided staging paths.
- Added a mission panel for launch, parking orbit shortcut, attitude holds, fixed Apollo burns, docking/configuration changes, LM ascent/descent transitions, CSM return, and guidance shutdown.
- Added mission guidance/autopilot assists for launch pitch guidance, prograde/retrograde/radial holds, and fixed TLI, LOI, PDI, and TEI burn commands.
- Added Moon support with a simplified moving lunar body, lunar SOI detection, active primary-body switching, body-relative orbit calculations, and safer time-warp behavior near the Moon.
- Added standalone Apollo data/helper modules for constants, checklists, mission profiles, failures, lessons, rendezvous planning, telemetry recording, and entry-guidance groundwork.
- Expanded Apollo documentation around gameplay goals, architecture boundaries, control mapping, scenario backlog, fidelity assumptions, and test coverage.

## Player Impact

- Players can now fly a more recognizable Apollo arc: launch, stage, reach parking orbit, inject toward the Moon, enter lunar SOI, capture, switch to LM modes, ascend, return to CSM mode, and execute TEI.
- Mission controls are visible and interruptible, making the sim feel more like a flight-director workflow than a free-flight sandbox alone.
- Propellant and vehicle configuration matter more because each mode carries distinct mass, thrust, and fuel assumptions.

## Engineering Notes

- The Apollo mission layer remains an integration layer over the existing scene, physics, maneuver-node, and spacecraft systems.
- Browser-global script loading is still the runtime model; Apollo data modules are intentionally side-effect-light and suitable for later scenario/objective wiring.
- Mission-owned burns and maneuver-node execution are separate systems today and should be coordinated through explicit ownership rules before deeper automation.

## Known Limitations

- TLI, LOI, PDI, and TEI are fixed guidance burns rather than generated maneuver nodes.
- Vehicle separation is abstracted through mode swaps on one active spacecraft; inactive CSM, LM, ascent stage, descent stage, and discarded stages do not yet persist as independent state vectors.
- Docking, rendezvous, lunar landing classification, surface collision, and entry corridor gameplay are not complete.
- The Moon/SOI model is intentionally simplified and does not yet include full patched-conic planning or robust event-stop prediction.
- The `cm` entry configuration exists as planning/profile data but is not yet a first-class runtime vehicle mode.
- Scenario objectives, checklist completion, failure evaluation, lesson flow, and telemetry-based scoring are documented foundations rather than a finished runtime campaign system.

## Testing And Docs

- Apollo behavior is covered by expanded manual test plans and architecture notes.
- Scenario, control, and fidelity docs now describe expected mission behavior, assist ownership, player controls, and acceptable simplifications.
- The mission simulation check remains the lightweight regression entry point for future automated coverage.

## Next Steps

- Replace fixed Apollo burns with maneuver-node generation and execution through the existing node system.
- Add mission phase guards, objective/checklist state, and clear warnings for invalid vehicle or orbit conditions.
- Persist inactive vehicle state so LM undock, descent, ascent, CSM rendezvous, docking, and jettison can become real gameplay.
- Implement lunar landing telemetry, surface collision, touchdown classification, and descent guidance.
- Add time-warp event stops for SOI changes, maneuver ignition, periapsis, low-altitude hazards, landing, docking, and entry interface.
- Wire the standalone profiles, checklists, failures, lessons, rendezvous planner, entry guidance, and telemetry recorder into runtime objectives and scoring.
