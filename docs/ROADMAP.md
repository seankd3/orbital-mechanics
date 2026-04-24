# Development Roadmap

Apollo CSM Orbital Mechanics Simulator

---

## Vision

An authentic Apollo-era orbital mechanics simulator with the soul of a flight sim and the clarity of a teaching tool. Piloted through a real DSKY interface, rendered in CRT vector graphics, progressing from Earth orbit through lunar transfer to full Apollo mission profiles.

The kind of thing that makes you understand *why* orbital mechanics works the way it does -- not by reading about it, but by getting it wrong five times and then nailing the burn.

### Design Principles

1. **Each phase is a complete experience.** After Phase 1 you have a great flight sim. After Phase 2 you have a planning tool. After Phase 3 you have something nobody else has built. Never leave the project in a half-finished state between phases.

2. **Authenticity over simulation.** Use real Apollo specs from the Operations Handbook (see `docs/reference/`), but simplify where complexity doesn't serve gameplay. The DSKY should feel real. The plumbing doesn't matter.

3. **Teach through failure.** The best orbital mechanics education is a bad burn that costs too much fuel. Finite resources, visible consequences, and enough information to understand what went wrong.

4. **CRT vector aesthetic is the identity.** Everything -- navball, DSKY, map view, maneuver nodes -- should look like it's drawn on a phosphor display. Wireframes, bloom, monospace, amber-on-black.

### What Exists Today (v1.7)

- Dual-mode physics (Keplerian on-rails / Newtonian integration)
- Apollo CSM wireframe model with 6-DOF rotation
- SAS (Stability Augmentation System) with rate damping
- Orbital trajectory visualization (cyan ellipse)
- Bottom-bar telemetry HUD (vehicle, orbit, attitude)
- Time warp (1x - 1000x) with automatic physics mode switching
- Chase camera with mouse orbit/zoom
- Post-processing bloom for CRT glow
- ISS-like 400km starting orbit with correct orbital velocity

### What's Missing

- No finite fuel (infinite thrust)
- No maneuver planning (fly by feel only)
- No navball (raw Euler angles for orientation)
- No DSKY (no Apollo computer interface)
- No Moon (single-body gravity only)
- No sound
- No rendezvous targets
- No mission structure

---

## Phase 1: "Make Flying Feel Real"

**Foundation -- turn the sandbox into a cockpit.**

Right now you can orbit and thrust, but there's no *feel*. This phase is about the moment-to-moment experience of controlling a spacecraft.

### 1a. Navball (Attitude Indicator)

A vector-drawn attitude indicator on the 3D HUD, rendered as a wireframe hemisphere to match the CRT aesthetic.

**Markers:**
- Prograde / retrograde (velocity direction relative to orbit)
- Normal / anti-normal (perpendicular to orbital plane)
- Radial in / out (toward / away from planet center)
- Horizon line relative to the planet surface

**Implementation notes:**
- Render as a second Three.js scene in a viewport overlay (avoids depth conflicts with main scene)
- Compute prograde from `spacecraft.velocity.normalize()`
- Compute normal from `cross(position, velocity).normalize()`
- Radial from `cross(velocity, normal).normalize()`
- Transform markers into spacecraft's local frame for display

**Why first:** This single addition transforms spatial awareness. You go from "I'm pointing somewhere" to "I'm pointing 23 degrees off prograde." Every subsequent feature (maneuver nodes, burns, rendezvous) depends on the player understanding their orientation relative to the orbit.

### 1b. Finite Fuel and Delta-V

Replace infinite thrust with real propellant mass based on Apollo specs from the Operations Handbook.

**SPS (Main Engine) -- from `docs/reference/sps-service-propulsion-system.md`:**

    Thrust:              91,189 N (currently 500 N -- update to real value)
    Specific impulse:    314 sec (vacuum)
    Usable propellant:   18,602 kg
    Spacecraft dry mass: 10,198 kg
    Total mass:          28,800 kg
    Delta-V budget:      ~3,200 m/s

**SM RCS -- from `docs/reference/rcs-reaction-control-system.md`:**

    Thrust per engine:   445 N
    Total propellant:    374 kg (4 quads)

**Physics:**
- Tsiolkovsky: `dv = Isp * g0 * ln(m_wet / m_dry)`
- Mass decreases as propellant burns: `dm/dt = thrust / (Isp * g0)`
- Acceleration increases as ship gets lighter
- Separate SPS and RCS propellant pools

**Telemetry bar additions:**
- `FUL` -- SPS propellant remaining (%)
- `DV` -- delta-v remaining (m/s)
- `RCS` -- RCS propellant remaining (%)

**Why this creates stakes:** Every burn becomes a decision with irreversible consequences. The delta-v budget for a lunar mission is tight (~3,200 m/s total covering LOI, TEI, midcourse, and margin). Wasting fuel in Earth orbit means you can't get home.

### 1c. RCS Translation

Add translational thrust using the existing RCS thruster visuals on the SM model.

**Controls:**
- I/K: translate forward/backward
- J/L: translate left/right
- U/O: translate up/down (or Shift+W/S)

**Specs (from handbook):**
- 445 N per jet, jets fire in pairs for translation
- Separate propellant from SPS
- Much lower thrust-to-weight ratio than SPS -- fine control, not orbit changes

**Why now:** Needed later for docking (Phase 5), but immediately useful for fine orbital adjustments and stationkeeping. Also makes the RCS visual cubes on the model meaningful -- they should flash when their corresponding jets fire.

### 1d. Sound Design

Web Audio API, no external dependencies.

**Engine sounds:**
- SPS ignition: deep rumble that builds over ~0.5 sec
- SPS steady state: low-frequency throb
- SPS cutoff: sharp silence (the sudden quiet is dramatic)
- RCS pulse: sharp pop/click per firing
- RCS steady: rapid clicking at pulse rate

**Ambient:**
- Orbital coast: quiet electrical hum, occasional system click
- Fan/air circulation undertone

**Alerts:**
- Master alarm: the iconic Apollo two-tone warning
- Collision: metallic impact

**Implementation:** Generate tones procedurally with OscillatorNode and noise buffers. No audio file dependencies. The lo-fi quality fits the aesthetic.

### 1e. Visual Polish

- Remove debug grid helper and axes helpers from the scene (and from the spacecraft model)
- Add continent coastline outlines to Earth wireframe (GeoJSON coastline data, projected to sphere, rendered as additional LineSegments)
- Thin atmosphere glow ring on Earth's limb (subtle blue-white line at the edge, maybe a torus geometry with low opacity)
- Proper Earth rotation so ground track is meaningful at time warp
- Re-enable the UnrealBloomPass (currently set up but only using RenderPass)

### Phase 1 "Done" Criteria

- Player can read their orientation from the navball and intuitively point prograde/retrograde
- Fuel depletes during burns, delta-v remaining is always visible
- Running out of fuel is possible and consequential (engine stops)
- RCS jets fire visually and provide fine translation control
- The sim has sound that responds to player actions
- Earth looks like Earth, not a featureless blue wireframe

---

## Phase 2: "Give Me Tools to Plan"

**Navigation -- transform from reactive flying to deliberate mission planning.**

This is the phase that turns it from a tech demo into something you can *play*. KSP proved the core insight: orbital mechanics becomes fun when you can see the consequences of a burn before you commit.

### 2a. Maneuver Nodes

The single most impactful gameplay feature.

**Interaction:**
- Click on the orbital trajectory line to place a node at that point
- Node appears as a marker on the orbit with six drag handles:
  - Prograde / retrograde (green)
  - Normal / anti-normal (purple)
  - Radial in / out (cyan)
- Dragging a handle adjusts the planned delta-v in that direction
- The predicted post-burn orbit renders as a second trajectory line (yellow/orange)

**Information display:**
- Delta-v cost of the burn (m/s)
- Burn duration at current thrust (accounting for mass change)
- Time to node (countdown)
- Predicted periapsis/apoapsis of post-burn orbit
- Multiple nodes for multi-burn sequences (each subsequent node shows its predicted orbit)

**Implementation notes:**
- Raycasting against the orbital trajectory BufferGeometry for click detection
- Store maneuver as `{ trueAnomaly, progradeV, normalV, radialV }`
- Predicted orbit: apply the delta-v impulse to current state propagated to the node time, then compute new orbital elements
- Trajectory update can be throttled (recompute on drag end, not every frame)

### 2b. Burn Execution

**Auto-orient:**
- When a maneuver node is selected and burn mode is entered (via DSKY P40 in Phase 3, or a simple key in Phase 2), spacecraft auto-rotates to the burn vector using SAS
- Navball shows the maneuver node marker; player confirms orientation

**Burn timing:**
- Start burn at `T - (burn_duration / 2)` so the midpoint of the burn is at the node (this is how real missions do it)
- Countdown timer to ignition
- During burn: show remaining delta-v error vector in real time
- Auto-cutoff when target delta-v is reached (within tolerance)
- Allow manual override (player holds SPACE to burn, releases to cut)

### 2c. Map View

Toggle with M key. Switches to a top-down orthographic camera looking along the orbital plane normal.

**Display:**
- Earth at center
- Current orbit (cyan)
- Predicted orbit after maneuver (yellow)
- Maneuver node markers
- Spacecraft position marker with velocity vector
- Periapsis/apoapsis markers (Pe/Ap labels)
- Zoom in/out with scroll wheel
- Pan with mouse drag

**Style:** Same CRT wireframe aesthetic. Grid lines at altitude intervals (100km, 500km, 1000km). Dark background, vector lines, bloom glow.

**Why map view matters:** The 3D chase camera is great for immersion but terrible for understanding orbital geometry. Map view is where planning happens.

### 2d. Hohmann Transfer Helper

An educational tool: given a target altitude, calculate and display the optimal two-burn Hohmann transfer.

- Input: target orbit altitude (via UI or keyboard entry)
- Display: transfer ellipse overlaid on current orbit
- Show both burns (raise apoapsis, then circularize)
- Show delta-v cost for each burn and total
- Optionally auto-create the two maneuver nodes

This teaches the most fundamental orbital maneuver through direct manipulation rather than textbook equations.

### Phase 2 "Done" Criteria

- Player can place a maneuver node, see the predicted orbit, and execute the burn
- Hohmann transfers between circular orbits are routine
- Map view provides clear orbital geometry understanding
- Burn execution is precise (auto-cutoff within 1 m/s of target)
- Multiple maneuver nodes can be chained for complex transfers

---

## Phase 3: "The DSKY"

**Apollo identity -- the thing that makes this sim unique.**

Every space sim has maneuver nodes. Nobody has a working DSKY. This is the signature feature that transforms the project from "orbital mechanics sandbox" to "Apollo flight simulator."

### 3a. DSKY Hardware Interface

Render as an overlay panel, toggled with G key.

**Display elements:**
- PROG display (2 digits) -- current program number
- VERB display (2 digits) -- current verb
- NOUN display (2 digits) -- current noun
- R1, R2, R3 registers (5 digits each, signed +/-)
- COMP ACTY indicator (computation in progress)
- Status lights: PROG, KEY REL, OPR ERR, RESTART, UPLINK ACTY, TEMP, NO ATT, GIMBAL LOCK, STBY, TRACKER

**Input:**
- Clickable numpad: 0-9, +, -, VERB, NOUN, CLR, PRO, KEY REL, ENTR, RSET
- Keyboard shortcut mapping: V for VERB, N for NOUN, Enter for ENTR, number keys for digits
- Input buffer with echo (shows digits as you type before ENTR)

**Visual style:** Render with HTML/CSS overlay, not Three.js. Green electroluminescent segments on dark panel. Same Courier New font. Subtle bloom around active segments.

### 3b. AGC State Machine

The software architecture behind the DSKY.

    class AGC {
        program       // Current running program (P00, P11, P40, etc.)
        verb          // Current verb
        noun          // Current noun
        registers     // R1, R2, R3 (numeric values)
        inputBuffer   // Digits being entered
        alarms        // Active alarm codes
        waitingForInput // Which register is awaiting data entry
    }

**Program execution model:**
- Programs run continuously, updating registers each frame
- V37 (Change Program) switches the active program
- V33 (Proceed) advances through program steps
- V34 (Terminate) returns to P00
- Programs can request keyboard input (lights KEY REL)

### 3c. Core Programs

**P00 -- CMC Idle**
- Default state, coast mode
- Displays nothing special, accepts new program via V37

**P11 -- Earth Orbit Monitor**
- R1: velocity (m/s)
- R2: altitude rate (m/s)
- R3: altitude (km)
- Continuously updates

**P20 -- Tracking**
- Monitors target vehicle (Phase 5)
- R1: range to target (km)
- R2: range rate (m/s)
- R3: relative velocity (m/s)

**P30 -- External Delta-V**
- Accepts maneuver node data
- R1: delta-v X (m/s)
- R2: delta-v Y (m/s)
- R3: delta-v Z (m/s)
- PRO to accept, feeds into P40

**P40 -- SPS Thrusting**
- The burn program. Sequence:
  1. Display time to ignition (R1), delta-v remaining (R2)
  2. Auto-orient spacecraft to burn vector
  3. COMP ACTY lights during alignment
  4. Countdown: R1 shows seconds to ignition
  5. PRO to confirm ignition
  6. Engine start, R1 shows delta-v remaining
  7. Auto-cutoff at target delta-v
  8. Display residual (how close to target)

**P47 -- Thrust Monitor**
- For manual burns
- R1: delta-v accumulated X
- R2: delta-v accumulated Y
- R3: delta-v accumulated Z

**P52 -- Platform Alignment** (educational mini-game)
- Simplified star sighting: identify stars through a simulated sextant view
- Aligns the IMU (resets attitude reference)
- Adds depth to the experience between burns

### 3d. Essential Verbs and Nouns

**Verbs:**

    V06  Display decimal (one-shot)
    V16  Monitor decimal (continuous update)
    V21  Load component 1 (enter data into R1)
    V22  Load component 2 (enter data into R2)
    V23  Load component 3 (enter data into R3)
    V33  Proceed (advance program)
    V34  Terminate (return to P00)
    V35  Test lights (flash all indicators)
    V37  Change program (enter new program number)

**Nouns:**

    N17  Attitude (pitch, yaw, roll in degrees x100)
    N29  Delta-V remaining (x, y, z in m/s x10)
    N33  Time of ignition (hours, minutes, seconds)
    N43  Latitude, longitude, altitude
    N62  Velocity, altitude rate, altitude
    N81  Delta-V for next maneuver (total, x, y)
    N84  Velocity to be gained (x, y, z)

### 3e. Program Alarms

    1202  Executive overflow (too many tasks)
    1210  IMU not operating
    0210  IMU not aligned (P52 not run)
    0220  Gimbal lock (attitude angles exceeded)

Master alarm triggers the audio warning tone and lights the PROG indicator. Player presses RSET to acknowledge.

### Phase 3 "Done" Criteria

- DSKY overlay renders with authentic appearance
- V37 switches between programs, V06/V16 display data with correct nouns
- P40 can execute a burn with auto-orient, countdown, and auto-cutoff
- P11 continuously monitors orbital parameters
- Program alarms fire for invalid states
- Player can fly an entire orbit adjustment using only DSKY commands
- Keyboard and click input both work

---

## Phase 4: "Somewhere to Go"

**The Moon -- transforms the sim from a sandbox into a journey.**

A single body to orbit is a toy. Two bodies with transfer trajectories is a mission.

### 4a. Lunar Body

**Real parameters:**
- Mass: 7.342 x 10^22 kg
- Radius: 1,737 km
- Orbital radius: 384,400 km from Earth
- Orbital period: 27.3 days
- Orbital velocity: ~1,022 m/s

**Visual:** Wireframe sphere with crater rim outlines (same IcosahedronGeometry approach as Earth, but grey wireframe instead of blue). Smaller detail level -- the Moon is small.

**Orbit:** The Moon orbits Earth. Its position updates each frame based on a simple circular orbit (eccentricity of the real Moon is 0.0549 -- close enough to circular for gameplay). At 1000x warp, the Moon's motion over minutes of game time should be visible.

### 4b. Patched Conics

**This is the hardest technical challenge in the roadmap.**

The physics engine currently assumes a single gravitational body. Patched conics extends this by dividing space into spheres of influence (SOI), where only one body's gravity matters at a time.

**SOI radii (Hill sphere approximation):**
- Earth SOI: ~929,000 km
- Moon SOI: ~66,100 km

**Implementation:**
1. Each frame, check if spacecraft is within Moon's SOI
2. If crossing SOI boundary:
   - Transform position and velocity to new reference frame
   - Recompute orbital elements around new central body
   - Switch gravitational source
3. Orbital trajectory visualization must handle SOI transitions:
   - Show orbit around current body
   - Show entry/exit point on SOI boundary
   - In map view, show trajectory segments in each SOI

**Reference frame switching:**
- Position: `pos_moon = pos_earth - moon_pos_earth`
- Velocity: `vel_moon = vel_earth - moon_vel_earth`
- Must be done cleanly to avoid discontinuities

**Architecture change:** `updatePhysics()` in scene.js needs to know which body is the current primary. Create a `GravitySystem` or `SolarSystem` class that manages multiple bodies and SOI logic.

### 4c. Trans-Lunar Injection (TLI)

The first big burn. From the 400km parking orbit, a prograde burn of ~3,100 m/s places the spacecraft on a transfer trajectory to the Moon.

**Gameplay:**
- Use maneuver nodes (Phase 2) to plan the TLI burn
- The predicted trajectory must extend to show lunar encounter
- Timing matters: burn must be placed so the transfer arc arrives where the Moon will be (not where it is now)
- With the full 3,200 m/s delta-v budget, TLI consumes the majority of fuel

**Display:**
- Show the transfer ellipse extending from Earth orbit to lunar distance
- Show Moon's position at arrival time
- Show closest approach to Moon
- Time of flight: ~3 days (at 1000x warp, ~4.3 real minutes)

**Free-return trajectory:** If the TLI burn is sized correctly, the trajectory naturally returns to Earth if no LOI burn is performed. This is the Apollo 13 safety concept. Show whether the current transfer is free-return or not.

### 4d. Lunar Orbit Insertion (LOI)

Upon entering the Moon's SOI, the spacecraft is on a hyperbolic trajectory relative to the Moon. A retrograde burn captures into lunar orbit.

**From `docs/reference/spacecraft-mass-budget.md`:**

    LOI burn: ~900 m/s

**Gameplay:**
- Approach the Moon, watch the SOI transition happen
- Orbital elements switch to lunar reference frame
- Use maneuver nodes to plan the capture burn
- Get it wrong: fly past the Moon (possibly on a free-return back to Earth, possibly not)
- Get it right: settle into a ~110 km circular lunar orbit

**LOI-1 and LOI-2 (realistic Apollo sequence):**
- LOI-1: large burn to capture into elliptical orbit (e.g., 110 x 310 km)
- LOI-2: smaller burn at periapsis to circularize
- Two-burn approach is more fuel-efficient and authentic

### 4e. Trans-Earth Injection (TEI)

The trip home. A prograde burn in lunar orbit (relative to the Moon's surface, but retrograde relative to the Moon's orbital velocity) sends the spacecraft back to Earth.

**From mass budget:**

    TEI burn: ~1,000 m/s

After TEI, the spacecraft coasts back to Earth, re-enters the Earth's SOI, and the trajectory becomes an Earth-relative orbit (or direct entry path).

### 4f. Map View Upgrade

- Zoom out to show full Earth-Moon system
- SOI boundaries drawn as dotted circles
- Transfer trajectory drawn across SOI boundaries
- Moon's orbit drawn as a thin line
- Time-to-SOI-transition countdown
- Phase angle between spacecraft and Moon displayed

### Phase 4 "Done" Criteria

- Moon is visible from Earth orbit, orbiting realistically
- TLI burn sends spacecraft on a multi-day transfer
- SOI transition works cleanly (no position/velocity jumps)
- LOI capture into lunar orbit is achievable
- TEI sends spacecraft back to Earth
- Full Earth-Moon round trip is possible with careful fuel management
- Map view shows the complete picture

---

## Phase 5: "Rendezvous"

**The hardest problem in orbital mechanics, made playable.**

Rendezvous is what separates button-pushers from pilots. It's the most satisfying challenge in any space sim, and it's what Apollo missions actually spent the most critical minutes doing.

### 5a. Target Vehicle

Spawn a passive target in a separate orbit (selectable scenarios):
- ISS-style station in Earth orbit (for practice)
- LM ascent stage in lunar orbit (for Apollo scenarios)
- Disabled satellite in an eccentric orbit (rescue mission)

**Display:**
- Target orbit as a separate trajectory line (different color, e.g., white)
- Target position marker
- Distance and relative velocity readouts in telemetry bar
- Closest approach prediction (distance and time)

### 5b. Rendezvous Tools

**Phase angle:** Angular distance between spacecraft and target in their orbits. Display numerically and as a marker on the map view.

**Relative motion indicators:**
- Navball gains target prograde/retrograde markers (relative velocity direction)
- Closing velocity (approach/recession rate)
- COAS (Crew Optical Alignment Sight): a simple crosshair overlay showing target bearing from the spacecraft

**Intercept planning:**
- Hohmann-style transfer between current orbit and target orbit
- Compute phase angle for optimal transfer initiation
- Time-to-optimal-burn countdown

### 5c. Terminal Approach

When within ~10 km of target:
- Switch to relative reference frame (target-centered)
- Show distance in meters, closing rate in m/s
- V-bar / R-bar approach corridors (horizontal and vertical approach paths)
- This is where RCS translation (Phase 1c) becomes essential
- Range/range-rate display (approach should be: slower as you get closer)

### 5d. Docking

Simple proximity + alignment docking:
- Spacecraft must be within 2m of target docking port
- Approach velocity < 0.5 m/s
- Angular alignment within 5 degrees
- Soft dock → hard dock sequence (visual + audio feedback)
- Camera option: switch to docking-port-forward view

### 5e. Rendezvous Scenarios

Based on real Apollo techniques (from NASA Flight Journal):

**Coelliptic (Apollo 11 method):**
- Launch into lower orbit, ~2 orbits to rendezvous
- CSI burn: match altitudes
- CDH burn: establish constant delta-height
- TPI burn: terminal phase intercept
- Step-by-step, forgiving of small errors

**Direct (Apollo 14+ method):**
- Single orbit to rendezvous
- Skip intermediate burns, go straight to TPI
- Faster but requires more precise execution

### Phase 5 "Done" Criteria

- Target vehicle visible in orbit with its own trajectory
- Phase angle and relative motion displays are accurate
- Player can plan and execute a rendezvous from a different orbit
- Docking is achievable with RCS controls
- Both coelliptic and direct approaches work

---

## Phase 6: "Full Apollo"

**Mission mode -- the complete experience.**

Everything from the previous phases connects into narrative scenarios.

### 6a. Mission Scenarios

**Gemini-style (tutorial tier):**
- Earth orbit rendezvous with a target vehicle
- Practice maneuver nodes, burns, rendezvous, docking
- No Moon, no TLI -- pure skill training

**Apollo 8 (intermediate):**
- First lunar orbit mission (Christmas 1968)
- TLI, coast, LOI, 10 lunar orbits, TEI, return
- No docking, no landing -- focus on navigation and burns
- The "hello world" of lunar missions

**Apollo 11 (advanced):**
- Full mission: TLI, LOI, LM separation (scripted event), lunar orbit operations, rendezvous with LM ascent stage, docking, TEI, return
- Requires all skills: planning, execution, rendezvous

**Apollo 13 (emergency):**
- SPS engine disabled after TLI (failure event)
- Must use free-return trajectory
- Limited power (fuel cells compromised)
- Use LM engine for midcourse correction (if LM is modeled) or RCS
- The ultimate problem-solving scenario

### 6b. Mission Framework

- Mission timer (MET -- Mission Elapsed Time) displayed prominently
- Phase-based checklist system tied to DSKY programs
- Go/no-go decision points before major burns
- CAPCOM-style text callouts at key events:
  - "You are GO for TLI"
  - "LOI-1 burn nominal"
  - "Contact light"

### 6c. Simplified Re-entry

- Atmospheric drag model below ~120 km altitude
- Entry corridor: too steep = excessive deceleration (> 10g, mission failure), too shallow = skip off atmosphere
- Heating indicator (visual only, not a full thermal model -- screen edges glow red)
- Communications blackout during peak heating (telemetry displays go static)
- Drogue chute at 7 km altitude, main chutes at 3 km
- Splashdown = mission complete

### 6d. Failure Modes

Scriptable system failures that change the problem:
- Fuel cell loss: reduced electrical power, instrument brownouts
- RCS quad failure: asymmetric thrust, harder attitude control
- SPS gimbal stuck: engine can't point where you want, must compensate with RCS
- Communications antenna failure: no CAPCOM callouts, fly by instruments alone
- Each failure has a corresponding DSKY program alarm

### Phase 6 "Done" Criteria

- At least two complete mission scenarios are playable start to finish
- Apollo 8 (orbit) and Apollo 11 (rendezvous) as minimum
- Mission timer, checklists, and CAPCOM callouts create narrative
- Re-entry is a skill challenge, not just a cutscene
- At least one failure scenario (Apollo 13-style) exists

---

## Phase 7: "Polish and Share"

**Production quality -- make it something worth sharing.**

### 7a. Technical Modernization

- Migrate to ES modules + Vite bundler (zero config, fast HMR)
- Upgrade Three.js to current stable release
- Tree-shake unused Three.js code
- Loading screen with progress bar
- Save/load simulation state to localStorage
- Performance profiling pass (especially patched conics + trajectory rendering)

### 7b. Onboarding

Interactive tutorials that teach through guided play:

1. **"Achieve Orbit"** -- teaches prograde/retrograde, the navball, and circularization
2. **"Hohmann Transfer"** -- teaches maneuver nodes, burn execution
3. **"The DSKY"** -- teaches V37, P11, P40 through a guided burn sequence
4. **"Rendezvous 101"** -- teaches phase angles, closing velocity, docking

Each tutorial overlays instruction text at the right moment, lets the player attempt the maneuver, and validates success. Minimal hand-holding -- just enough context to understand what to try.

### 7c. Input and Accessibility

- Gamepad/joystick support (navigator.getGamepads API)
- Configurable key bindings (stored in localStorage)
- Touch controls for tablet (virtual joystick overlay)
- Colorblind-friendly orbit line color options

### 7d. Deployment

- Deploy to GitHub Pages (static site, no server needed)
- Share-worthy screenshots (capture canvas + HUD as PNG)
- OG meta tags for social sharing previews
- Mobile-responsive layout (at minimum, don't break on small screens)

### Phase 7 "Done" Criteria

- Project loads fast, runs smooth, looks polished
- New player can complete the first tutorial without external instructions
- Gamepad works for flight control
- Live on a public URL

---

## Technical Architecture Notes

### When to Refactor

- **Phases 1-2:** The current vanilla JS + `<script>` tag architecture is fine. Don't add build complexity during rapid feature iteration. Keep using CDN Three.js.
- **Phase 3:** The AGC/DSKY needs a proper state machine. Add an `agc.js` module with a class-based architecture (program registry, verb/noun dispatch, register file).
- **Phase 4:** Patched conics is the biggest architectural change. Refactor `physics.js` to support multiple bodies. Create a `SolarSystem` class that manages bodies and SOI transitions. Plan this carefully before writing code.
- **Phase 7:** Migrate to ES modules only after features stabilize. The module migration is mechanical but touches every file.

### Key Technical Risks

| Risk | Phase | Mitigation |
|------|-------|------------|
| Patched conics SOI transitions cause discontinuities | 4 | Test extensively at SOI boundary. Use the same propagation method on both sides. Log state vectors before/after transition. |
| Maneuver node prediction diverges from actual execution | 2 | Use identical physics code for prediction and execution. Impulsive approximation for planning, finite burn for execution. |
| DSKY state machine complexity | 3 | Start with P00, P11, P40 only. Add programs incrementally. Each program is a self-contained class. |
| Performance with multiple trajectory renderings | 4-5 | Throttle trajectory updates (1Hz is fine). Use LOD: fewer points when zoomed out. Don't recompute if orbital elements haven't changed. |
| Three.js version upgrade breaks post-processing | 7 | Pin the version until Phase 7. Test the upgrade in a branch. |

### File Structure (Projected)

    js/
      main.js              # Entry point
      scaleManager.js       # Scale conversion
      physics.js            # Orbital mechanics, gravity, Kepler
      solarSystem.js        # [Phase 4] Multi-body management, SOI
      planet.js             # Planet class
      spacecraft.js         # Spacecraft model, propulsion, fuel
      scene.js              # Rendering, camera, animation loop
      navball.js            # [Phase 1] Attitude indicator
      maneuverNode.js       # [Phase 2] Node placement, prediction
      mapView.js            # [Phase 2] Orthographic orbital map
      agc.js                # [Phase 3] Apollo Guidance Computer
      dsky.js               # [Phase 3] DSKY display and input
      agc/
        programs/           # [Phase 3] P00.js, P11.js, P40.js, etc.
      rendezvous.js         # [Phase 5] Relative motion, docking
      mission.js            # [Phase 6] Scenario framework
      audio.js              # [Phase 1] Sound system
      ui.js                 # [Phase 2] Telemetry bar, HUD management

---

## The Throughline

Each phase answers the question the player naturally asks next:

| Phase | Question | Answer |
|-------|----------|--------|
| 1 | "How do I control this thing?" | Navball, fuel, sound -- embodied flight |
| 2 | "How do I get where I want to go?" | Maneuver nodes, burn planning, map view |
| 3 | "How did Apollo actually do this?" | DSKY -- fly it the way they flew it |
| 4 | "Can I go to the Moon?" | TLI, LOI, TEI -- the lunar journey |
| 5 | "Can I meet another ship?" | Rendezvous, docking -- the hardest skill |
| 6 | "Can I fly a whole mission?" | Scenarios with narrative, checklists, failure |
| 7 | "Can I share this?" | Polish, tutorials, deploy |

---

## Reference Materials

- `docs/external/SM2A-03-SC012-ApolloOperationsHandbook-Spacecraft012.pdf` -- Primary source
- `docs/reference/sps-service-propulsion-system.md` -- SPS specs with simulator values
- `docs/reference/rcs-reaction-control-system.md` -- RCS specs, quad layout, valve timing
- `docs/reference/scs-stabilization-control.md` -- Rate limits, deadbands, control modes
- `docs/reference/spacecraft-mass-budget.md` -- Mass breakdown, delta-V budget
- [Apollo Guidance Computer - Wikipedia](https://en.wikipedia.org/wiki/Apollo_Guidance_Computer)
- [Virtual AGC Home Page](https://www.ibiblio.org/apollo/ForDummies.html)
- [Apollo Flight Journal - Lunar Orbit Insertion](https://history.nasa.gov/afj/loiessay.html)
- [Apollo Flight Journal - Lunar Orbit Rendezvous](https://history.nasa.gov/afj/loressay.html)
- [Apollo Lunar Orbit Rendezvous Guide](https://apollo11space.com/apollo-lunar-orbit-rendezvous-a-detailed-guide-to-the-orbital-ballet-of-the-apollo-missions/)
