# Simulation Fidelity

This note describes the current Apollo simulation model and the fidelity layers needed before calling it a full Apollo mission simulator. The short version: the project is a playable orbital mechanics sandbox with Apollo-flavored vehicles and mission commands, not yet a validated Apollo trajectory, guidance, landing, or rendezvous simulation.

## Current Fidelity

- Gravity is single-primary at any instant. The scene integrates the spacecraft against the active `planet`, and the mission layer switches the primary body between Earth and Moon when the spacecraft enters the Moon sphere of influence.
- The Moon is a simplified circular-orbit body with a fixed SOI radius. It is useful for Earth-Moon gameplay and phase-angle intuition, but it is not an ephemeris-driven lunar model.
- Time warp uses Keplerian propagation for bound, non-thrusting trajectories; thrusting and normal flight use numerical integration with limited substeps at warp. Maneuver prediction is impulsive: apply a planned delta-v at the node state, then draw the resulting conic around the current primary.
- Rendering and telemetry emphasize clarity over system completeness: vector-style Earth/Moon, trajectory lines, a navball, map view, fuel/delta-v readouts, fixed mission buttons, and simplified DSKY-like readouts.

## Patched Conics vs. N-Body

The current model is closest to patched conics, but only in the first practical layer:

- One body owns gravity at a time.
- SOI transitions are discrete.
- Relative position/velocity are reinterpreted against the new primary.
- Transfer and maneuver displays are local conics, not integrated multi-body trajectories.

That is the right next layer for a readable Apollo sim. It keeps planning teachable and matches the broad way Apollo mission design is often introduced. A full n-body model would continuously sum Earth, Moon, Sun, and possibly oblateness/third-body effects. That is better for validation and high-fidelity propagation, but it is harder to present as clean player feedback.

Recommended layering:

1. Keep patched conics as the gameplay/planning layer.
2. Make SOI transition state handling explicit and testable.
3. Add optional high-fidelity propagation for validation runs, not necessarily for the main cockpit loop.
4. Compare patched-conic outputs against the high-fidelity propagator to set error bounds.

## Saturn V Ascent

Current Saturn V ascent is intentionally simplified:

- Stages use approximate thrust, dry mass, propellant mass, and Isp values.
- Guidance is a simple radial-to-east pitch program from the Cape, with staging on propellant depletion.
- Parking orbit insertion can also be forced directly through a mission command.
- Earth rotation is represented as an initial pad tangential velocity.

Missing from an Apollo-grade ascent model:

- Atmosphere, drag, max-Q, aerodynamic stability, and structural limits.
- Throttle schedules, engine-out behavior, mixture ratio details, ullage, and shutdown timing.
- Launch azimuth targeting, roll program, pitch/yaw steering laws, and guidance updates.
- Staging transients, coast phases, S-IVB restart details, and insertion dispersions.

Treat ascent today as a launch-to-orbit convenience and visual mission phase, not a validated Saturn V flight dynamics model.

## CSM and LM Propulsion

The CSM propulsion model is stronger than the rest of the mission stack, but still simplified:

- CSM SPS uses Apollo-like values: 91,189 N thrust, 314 s Isp, 18,602 kg usable propellant, and a roughly 28,800 kg loaded CSM mass budget.
- SM RCS translation uses paired 445 N jets as an 890 N thrust vector with its own propellant pool.
- CSM+LM, LM descent, and LM ascent modes have approximate mass, thrust, propellant, and Isp values.
- Delta-v is calculated with Tsiolkovsky mass depletion, and burn progress is tracked from mass change.

Current assumptions:

- Engines produce constant vacuum thrust.
- LM descent throttle behavior is not modeled.
- RCS attitude control is abstract angular damping/rates, not individual jet selection and torque.
- SPS gimbal, trim, ullage, feed systems, pressure limits, ignition delays, restarts, and failure modes are not simulated.
- Vehicle mode switches stand in for physical separations unless specific staging behavior exists.

## Landing and Rendezvous Future Work

Landing is not yet a landing simulation. The current PDI command is a fixed retrograde burn and the LM mode can be selected, but there is no powered descent guidance, terrain model, landing site targeting, contact dynamics, hover/abort logic, or surface state.

Rendezvous is also not yet a rendezvous simulation. Docking/transposition currently behaves as a mission state change. Future work should add:

- Separate CSM and LM state vectors.
- Relative navigation displays: range, range rate, line-of-sight rate, phase angle, closing corridor.
- Coelliptic and direct rendezvous planning aids.
- LM ascent targeting into a rendezvous orbit.
- RCS-based proximity operations, docking alignment, soft/hard capture states, and collision handling.

## Validation Needed Before "Full Apollo"

Before the project claims full Apollo simulation fidelity, validate at least these layers:

- Unit and scale consistency across real-world, visualization, velocity, force, and mass conversions.
- Two-body orbit propagation against analytic Kepler references over many orbits.
- Numerical integration energy/angular-momentum drift at 1x and time warp.
- Maneuver node prediction versus executed finite burns, including midpoint burn timing.
- SOI transition continuity: no position/velocity jumps, correct relative energy before and after patching.
- Earth-Moon transfer cases: TLI timing, lunar closest approach, LOI capture, TEI return, and free-return behavior.
- Propellant and delta-v budgets against Apollo reference values for TLI, LOI, DOI/PDI, ascent, rendezvous, TEI, and margins.
- Saturn V ascent benchmark: launch time, staging times, parking orbit altitude, inclination, velocity, and remaining S-IVB capability.
- LM descent/ascent benchmark: descent fuel use, hover/abort margins, ascent insertion, and rendezvous geometry.
- Docking/proximity operations: stable relative motion, RCS consumption, alignment tolerances, and collision/contact behavior.
- Scenario regressions for Apollo 8-style lunar orbit, Apollo 11-style landing/rendezvous, and Apollo 13-style free-return or LM-engine contingency.

Until those checks exist with defined tolerances, the honest label is: Apollo-inspired orbital mechanics simulator with patched-conic mission scaffolding.
