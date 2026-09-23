# Orbital Mechanics Simulator - Changelog

## [4.0.0] - 2026-09-23 — Apollo 11, rewritten

A from-scratch rewrite around a campaign with a pull: nine graded
chapters, from TLI to splashdown, with flight-director cues. See `DESIGN.md`.

### Added
- **The campaign.** Nine chapters, each restartable and graded 0–3 ★. The
  flight carries through, and the menu starts any chapter you have reached
  from the nominal flight.
- **Flight-director cues.** A CAPCOM line with quindar tones. The computer
  solves each burn as a node you can drag in the map to have it re-solved.
  Also: a navball ◇ cue and throttle bug, F attitude hold, and G warp to
  the next event. B hands a phase to the computer (caps the chapter at ★★).
- **Real targeting.**
  - TLI window search with a finite S-IVB burn (replaces the Hohmann to the
    Moon's current radius).
  - Midcourse to a 110 km perilune.
  - LOI, a 2-D solve that circularizes despite a 7-minute burn.
  - DOI, and TEI to the −6.5° entry corridor.
  - Lambert TPI and braking.
- **Piloting set pieces.**
  - E-guidance powered descent (P63/P64/P66) to a graded touchdown, with
    the crew's automation: auto-throttle through P63/P64, and in P66 a
    rate-of-descent hold that Shift/Ctrl adjust.
  - P12 ascent timed to the CSM.
  - RCS prox ops and docking.
  - Lifting entry with bank guidance, reefed drogues and three mains.
- **Views.**
  - A true-scale chase camera in the local horizon frame.
  - An auto-framed top-down map with patched-conic paths and forecasts.
  - A surface patch for low flight (grids, craters, drop-line) and an
    ocean grid for splashdown.
- **Tests (44).**
  - Orbit and physics.
  - Coast determinism across warp.
  - Targeting flown against its own prediction (TLI perilune within 2 cm
    after a 3-day coast).
  - Guidance.
  - The whole mission on AUTO.
  - Hand-flown paths (TLI and landing for three stars) and failure paths.

### Changed
- One patched-conic propagator is used for flight, drawing and targeting.
  Coasting always rides the exact conic, so time warp no longer changes
  where you go.
- The look is restrained clean vectors (Sean's call): no bloom, scanlines or
  CRT shader.
- Vehicles: the CSM gains a CM stage for entry; the LM RCS is 4-jet
  (1,780 N).

### Removed
- Button panels (holds, burns, node ±, undock/dock/stage/swap, checkpoints),
  the Earth training objectives, fixed LOI/TEI magnitudes, the 30° parking
  orbit, and manual craft swap.
- Checklists, DSKY, failures and telemetry replay are not ported (decided);
  their specs are in `docs/archive/`.

### Fixed (found by the new tests)
- The Δv meter swallowed the first burn frame, a 0.15 m/s overburn on
  every burn.
- The partner craft's conic was anchored one frame late (kilometers of
  drift under warp).
- The SOI handoff depended on the warp rate.

## [3.1.0] - 2026-07-09 — Full Apollo stack

### Added
- CSM and LM as two independently simulated craft (the inactive one coasts on
  Kepler rails); V swaps control when separated
- Undock / hard dock with range + relative-velocity gating; crew transfer and
  LM jettison after an ascent rendezvous
- Stage-aware vehicles: CSM = S-IVB (real J-2 numbers, flies TLI, staged away)
  + SPS; LM = DPS descent + APS ascent stages (game-tuned margins)
- Lunar surface touchdown (<8 m/s on airless bodies), liftoff TWR gating
- LM and S-IVB vector meshes, vehicle ops buttons, target dist/rel-vel readout

## [3.0.0] - 2026-07-09 — The merge

Unified the two lineages: the Apollo simulator's feature depth (main, Feb–May 2026)
rebuilt on the v2 Vite + TypeScript architecture.

### Added (ported from the Apollo build)
- Kinematic Moon with patched-conic SOI handoff — fly TLI, get captured, come home
- Maneuver node planner: TIG at now/AP/PE, prograde/normal/radial ΔV, predicted
  orbit line, auto-align, finite Tsiolkovsky-metered burns centered on TIG
- Apollo orbit-ops panel: attitude holds (PRO/RETRO/RAD±/NRM±), solved TLI and
  CIRC burns, fixed LOI/TEI, Earth/Moon checkpoints, orbit guard (GO/PE LOW/ESCAPE)
- Canvas navball with orbital-frame markers, horizon arcs, and maneuver cue
- MAP mode (M): orthographic view down the orbit normal
- Real night sky: HYG catalog (~8,900 stars, magnitude/B-V driven)
- Natural Earth 50m coastlines on the vector globe; crater-ringed vector Moon
- Synthesized cabin audio: SPS rumble, RCS pops, low-fuel master alarm
- RCS translation (I/K J/L U/O) with its own propellant budget

### Changed
- Tank and thrust sized for the full lunar arc (~5,970 m/s Δv, 400 kN)
- Not ported (dormant in the Apollo build too): checklists, lessons, failures,
  profiles, rendezvous planner, entry guidance — staged for later

## [2.0.0] - 2026-07-09 — Full rebuild

### Changed
- Rebuilt from scratch as a Vite + TypeScript ES-module app (was CDN script tags + globals on Three.js r132)
- Simulation now runs in true SI units with an RK4 integrator; render space is scaled separately
- Time warp up to 100,000×: numeric integration through 100×, exact on-rails Kepler propagation above (zero drift)
- Retro CRT vector aesthetic pushed further: phosphor graticule Earth, thin atmospheric limb glow, bloom + chromatic-fringe/vignette shader pass, CSS scanlines

### Added
- Fuel and delta-v budget (Tsiolkovsky), throttle control (Shift/Ctrl, Z/X)
- Exponential atmosphere below 140 km with drag — deorbits actually decay now
- Mission objectives: raise apoapsis → circularize → deorbit → reentry, ending in splashdown (or a crash if you skip steps)
- Orbit prediction line with periapsis/apoapsis markers, handles hyperbolic arcs
- Warp auto-cancel on manual control input and at atmospheric interface
- Notifications, mission log, and a redesigned green-phosphor HUD

### Removed
- Legacy `js/` global-namespace modules and CDN Three.js dependency

## [1.6.0] - 2025-03-30

### Added
- Added SAS (Stability Augmentation System) feature
  - Toggle with 'T' key to enable/disable
  - Provides stronger rotation damping when active for precise control
  - Status indicator shows SAS state in the spacecraft panel

### Changed
- Improved spacecraft rotation controls to use angular velocity instead of direct rotation
  - Spacecraft now has momentum when rotating, creating more realistic physics
  - Rotation builds up and continues after controls are released
  - SAS can be used to quickly stabilize rotation
- Greatly increased star field distances for more realistic space environment
  - Stars are now positioned much further away (up to 5,000,000 units)
  - Added more stars in the distance layer (20,000 stars)
  - Improved star sizing and distribution
  - Increased camera far clipping plane to accommodate distant stars

## [1.5.0] - 2025-03-30

### Changed
- Simplified spacecraft rotation system using Three.js built-in Object3D.rotate methods
- Implemented local space rotations for more intuitive controls:
  - Pitch: rotateX() - rotation around local X axis
  - Yaw: rotateY() - rotation around local Y axis
  - Roll: rotateZ() - rotation around local Z axis
- Removed complex quaternion math implementation

### Fixed
- Resolved gimbal lock issues in spacecraft rotation
- Addressed erratic rotation behavior
- Fixed thrust scaling issue where spacecraft thrust wasn't being properly converted from real-world to visualization space

### Changed
- Increased spacecraft thrust from 50N to 500N for better maneuverability

## [1.4.0] - 2025-03-10

### Added
- Added visual orbital trajectory representation that shows the spacecraft's orbit path
- Implemented automatic orbital path updates when spacecraft's orbit changes
- Created glowing cyan path for optimal visibility in space environment

### Technical Changes
- Added orbital plane orientation calculation for accurate 3D trajectory display
- Implemented efficient update mechanism to maintain performance
- Utilized THREE.js BufferGeometry and Line for rendering the orbital path

## [1.3.0] - 2025-03-10

### Added
- Added collision detection to prevent spacecraft from flying through the planet
- Added frame-by-frame debugging information for spacecraft position and velocity

### Changed
- Improved orbital velocity calculation to ensure stable circular orbits
- Updated perigee and apogee displays to show altitude above surface instead of distance from center
- Increased spacecraft thrust from 20,000N to 200,000N for better maneuverability

### Fixed
- Fixed missing ScaleManager reference in HTML which caused initialization errors
- Fixed orbital mechanics calculations to ensure proper perpendicular velocity vectors
- Fixed issue where spacecraft would fall toward the planet despite correct orbital parameters

## [1.2.0] - 2025-03-10

### Added
- Implemented centralized controls system that separates input handling from scene management
- Created dedicated Controls class in new controls.js file

### Changed
- Refactored keyboard event handling to improve code organization
- Moved control logic out of Scene class for better separation of concerns
- Improved modularity of the code structure

### Technical Changes
- Enhanced maintainability through better code organization
- Improved extensibility for future control schemes

## [1.1.0] - 2025-03-10

### Added
- Added orbital parameters display in the UI (perigee, apogee, eccentricity, orbital period, semi-major axis)
- Added detailed orbital mechanics calculations based on real physics
- Added large starfield background sphere for improved space environment visuals
- Implemented logarithmic depth buffer for better distance rendering
- Updated spacecraft model to resemble Apollo Command Service Module (CSM)
  - Command Module: Cone shape at front
  - Service Module: Cylindrical body
  - Engine: Cone at rear
  - RCS Thrusters: Small cubes positioned around service module
- Implemented realistic rotational physics with angular momentum conservation
- Added thruster visual effects that activate when thrusting

### Changed
- Improved planet visualization using IcosahedronGeometry for a more geodesic appearance
- Swapped planet colors (black base with blue wireframe)
- Reduced star point size for more realistic appearance
- Increased camera far clipping plane to 1,000,000 units to prevent horizon cutoff
- Streamlined UI by removing redundant velocity indicators
- Modified spacecraft orientation: Z-axis forward, Y-axis up
- Improved wireframe rendering to hide back-facing lines using two-material approach
- Updated world grid to be horizontal in XZ plane
- Set SF Mono font for all axis labels
- Changed control scheme to be more intuitive
- Implemented conservation of angular momentum (rotation continues until countered)
- Engine exhaust now visually represented with dynamic scaling effects

### Fixed
- Fixed abrupt horizon cutoff issue by improving camera settings and adding proper starfield background
- Fixed planet rendering to appear more Earth-like with improved geometry

### Technical Changes
- Complete redesign of rotation physics system
  - Angular velocity is now persistent (simulating space environment)
  - Rotation now builds up gradually when controls are pressed
  - Very slight damping factor for numerical stability
- Updated animation loop for better performance
- Control keys now work by applying angular acceleration rather than direct rotation

### Controls
- W: Pitch up (nose up)
- S: Pitch down (nose down)
- A: Yaw right (nose right) 
- D: Yaw left (nose left)
- Q: Roll left
- E: Roll right
- SPACEBAR: Fire main engine

## [1.0.0] - 2025-03-09

### Added
- Initial implementation of orbital mechanics simulator
- Added Earth-like planet with gravitational physics
- Implemented proper orbital mechanics for spacecraft
- Created orbital information display in UI
- Added spacecraft controls and visuals

## [1.7.0] - 2025-04-01

### Added
- Added screen space glow effect to mimic a CRT vector display
  - Implemented using UnrealBloomPass from Three.js examples
  - Updated createEdgedMesh in js/spacecraft.js and createPlanetMesh in js/planet.js to use THREE.MeshBasicMaterial with emissive properties
  - Updated index.html to include the new UnrealBloomPass script from Three.js examples
