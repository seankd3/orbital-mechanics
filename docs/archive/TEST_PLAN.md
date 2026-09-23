# Apollo Sim Test Plan

This plan covers the browser Apollo mission sim from startup through lunar operations. It is written as a practical release checklist: each item has a crisp pass/fail result, with manual checks for the current UI and automation targets for regressions.

## Test Setup

- Serve the repo over HTTP from the project root, for example `python3 -m http.server 8000`, then open `http://localhost:8000/`.
- Run browser checks with DevTools open and the console preserved.
- Use a fresh tab with cache disabled for release smoke tests.
- For automated math checks, run `node js/mission-sim-check.js`.
- Unless a test says otherwise, start from a fresh page load in the default `PRELAUNCH` state.

Pass/fail rule: a check fails if the page throws an uncaught exception, renders a blank scene, shows `NaN`/`undefined`/`Infinity` in user-facing telemetry, accepts an impossible command silently, or leaves thrust/guidance stuck on after an abort/off action.

## Manual Smoke Checklist

### Startup and Initial State

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-START-01 | Load `index.html` through the local HTTP server. | The Three.js scene renders Earth, spacecraft, bottom telemetry bar, DSKY panel, maneuver node editor, and Apollo mission panel within 5 seconds. | Blank canvas, missing panel, script load failure, or uncaught console error. |
| M-START-02 | Observe the mission panel immediately after load. | `PHASE` is `PRELAUNCH`, `ACTIVE` is `EARTH`, `VEH` is `SATURN V`, `GUID` is `IDLE`, and the log includes `GUIDANCE READY`. | Any field is empty, stale from a prior run, or reports the wrong active body/vehicle. |
| M-START-03 | Toggle camera/map controls with `C` and `M`, then zoom with the mouse wheel. | Camera mode/readout changes, map/craft views remain responsive, and the spacecraft/Earth remain visible. | Camera jumps to empty space, controls stop responding, or telemetry stops updating. |
| M-START-04 | Press `.` and `,` several times before launch. | Time warp indicator changes only to supported factors and returns cleanly to `1x`. | Warp factor becomes invalid, negative, undefined, or breaks physics updates. |

### Launch and Staging

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-LAUNCH-01 | Click `LAUNCH`. | Warp drops to `1x`, `PHASE` becomes `LAUNCH`, `GUID` shows launch guidance, `THR` turns on, and the log records `LAUNCH COMMIT`. | Launch does not start, thrust stays off, warp remains high, or console errors appear. |
| M-LAUNCH-02 | Let ascent run at `1x` for 30 seconds. | Altitude and velocity increase monotonically over several samples, attitude gradually pitches from radial toward east/prograde, and fuel decreases. | Vehicle falls through Earth, telemetry freezes, fuel increases, or attitude oscillates wildly. |
| M-LAUNCH-03 | Click `STAGE` during ascent. | The log records a stage event, vehicle/stage mass changes, no mesh disappears unexpectedly, and guidance continues or cleanly reports no available stage. | Vehicle becomes invisible, mass/fuel telemetry becomes invalid, or the command silently corrupts phase state. |
| M-LAUNCH-04 | Continue until automatic staging occurs, or use `STAGE` to exercise each stage. | Each separation happens once, active vehicle label advances through the Saturn V stack toward `CSM+LM`, and no spent stage keeps producing thrust. | A stage repeats, skips to an invalid vehicle, keeps thrusting after propellant depletion, or produces NaN orbit values. |
| M-LAUNCH-05 | Click `ORBIT` from any ascent/prelaunch state. | Sim resets into Earth parking orbit with `VEH` `CSM+LM`, `PHASE` `PARKING`, map view active, AP/PE near 185 km, and stable finite velocity. | Parking orbit has PE below atmosphere/surface, vehicle remains `SATURN V`, or guidance/thrust remains active. |

### Orbit Tools and Telemetry

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-ORBIT-01 | From `ORBIT`, watch one minute at `1x`. | AP, PE, SMA, PRD, ECC, TAP, and TPE remain finite and roughly stable; fuel does not drain while coasting. | Orbit readouts drift rapidly without thrust, show invalid values, or propellant changes while idle. |
| M-ORBIT-02 | Toggle holds: `PRO`, `RET`, `RAD`, `RIN`, `NRM`, `AN`. | `GUID` and log show the selected hold, SAS turns on, and the craft slews smoothly toward the matching navball/vector direction. | Wrong hold label, attitude snaps erratically, SAS status disagrees, or manual controls become unusable. |
| M-ORBIT-03 | Press `OFF` after an attitude hold. | `GUID` returns to `IDLE`, thrust is off, hold stops, and no further fuel is consumed. | Hold continues after `OFF`, thrust remains on, or log does not record guidance shutdown. |
| M-ORBIT-04 | Use RCS translation keys `I/K`, `J/L`, `U/O` in short pulses. | RCS fuel decreases slightly, velocity changes are small, and RCS audio/visual cues do not affect SPS fuel. | RCS consumes SPS fuel, produces enormous velocity changes, or works with zero RCS propellant. |

### Maneuver Nodes

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-NODE-01 | From parking orbit, press `N` or click `CREATE`. | Node state changes from `NO NODE`, DSKY `N42` reports a node, editor shows finite TIG, total delta-v, predicted AP/PE, ignition, alignment error, and burn duration. | Node UI stays blank, predicted orbit is missing, or any readout is invalid. |
| M-NODE-02 | Adjust `PRO`, `NRM`, and `RAD` by `+`, `-`, `++`, `--`; adjust TIG with `+1M`, `-1M`, `+5M`, `-5M`. | Total delta-v and axis readouts update by the requested increments, predicted orbit updates, and TIG never becomes an unusable negative display. | Buttons change the wrong axis, total delta-v disagrees with components, or prediction goes stale. |
| M-NODE-03 | Click `NOW`, `AP`, and `PE`. | TIG moves to now/apoapsis/periapsis, DSKY/node editor agree, and the node marker moves to the expected orbit location. | Node marker jumps off orbit, AP/PE placement fails silently, or editor/DSKY disagree. |
| M-NODE-04 | Click `ALIGN`, then `BURN` when alignment error is low. | Auto-align points at the maneuver vector, burn starts at the correct time or immediately when forced, remaining delta-v decreases, SPS fuel decreases, and cutoff leaves residual delta-v within 1 m/s for burns under 100 m/s and within 5 m/s for larger burns. | Burn starts while badly misaligned, misses cutoff, consumes no fuel, or leaves thrust stuck on. |
| M-NODE-05 | Click `ZERO` then `CLEAR`. | Axis values and total delta-v reset to zero; clearing removes the node, predicted orbit, burn countdown, and DSKY node status. | Any stale predicted orbit or active burn state remains after clear. |

### Mission Panel Assists

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-ASSIST-01 | From parking orbit, click `TLI`. | If a valid estimate exists, log shows `TLI START <dv>`, `GUID` shows TLI remaining delta-v, attitude holds prograde, thrust starts, and warp is forced to `1x`. | TLI starts outside Earth context, starts with no propellant, leaves warp high, or does not log a reason when unavailable. |
| M-ASSIST-02 | During a TLI/LOI/PDI/TEI/CIRC burn, click `OFF`. | Burn cancels immediately, thrust turns off, `GUID` becomes `IDLE`, and no remaining burn resumes without another command. | Burn resumes by itself, thrust remains on, or phase/log falsely report cutoff success. |
| M-ASSIST-03 | From a stable lunar-relative state, click `LOI`; from lunar orbit, click `TEI`; from a nonmatching state, try the same commands. | Valid burns start with the expected prograde/retrograde attitude and propellant use; invalid contexts produce a visible warning/log entry and no thrust. | Assist silently executes in the wrong body/vehicle/phase or corrupts the active body. |
| M-ASSIST-04 | Click `CIRC` from elliptical Earth or lunar orbit. | Assist chooses prograde when below circular speed and retrograde when above circular speed, then reports `CIRC OK` when no meaningful delta-v remains. | Circularize burn chooses the wrong direction or keeps burning after target speed. |
| M-ASSIST-05 | Click `DOCK`. | Vehicle becomes `CSM+LM`, phase/log indicate docked state, and orbit state is preserved. | Dock changes position/velocity unexpectedly, empties propellant, or works while leaving a mismatched vehicle label. |

### SOI Switch

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-SOI-01 | Use `ORBIT`, then `TLI`, then time warp/coast toward the Moon. | Range to Moon decreases over time, transfer trajectory remains finite, and time warp stays responsive during coast. | Range increases without explanation after TLI, transfer orbit disappears, or warp causes numerical explosion. |
| M-SOI-02 | Cross within the Moon SOI radius. | `ACTIVE` switches from `EARTH` to `MOON`, the log records `LUNAR SOI`, warp drops to `1x`, lunar AP/PE replace Earth AP/PE, and there is no visible position/velocity jump. | Active body does not switch, switches repeatedly, or the spacecraft teleports/loses trajectory. |
| M-SOI-03 | Leave lunar SOI on an escape/flyby path. | `ACTIVE` switches back to `EARTH`, the log records `EARTH SOI`, and Earth-relative telemetry remains finite. | Sim stays lunar-primary outside SOI or produces invalid Earth-relative orbit data. |

### LM Modes and Lunar Operations

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-LM-01 | From lunar orbit, click `LM`. | `VEH` changes to LM descent mode, phase/log show `LM ACTIVE`, guidance is idle, and the lunar orbit state is preserved. | Vehicle switch changes orbit, leaves CSM thrust/guidance active, or shows a wrong vehicle label. |
| M-LM-02 | Click `PDI` in LM descent mode. | Retrograde burn starts, LM/DPS propellant decreases, `PDI` remaining delta-v counts down, and cutoff returns to hold/idle without invalid telemetry. | PDI consumes the wrong propellant pool, starts outside lunar context without warning, or never cuts off. |
| M-LM-03 | Click `ASC`. | Vehicle changes to LM ascent mode, phase/log show `ASCENT STAGE`, descent-stage state does not reappear, and guidance is idle. | Mode switch fails, propellant/mass telemetry becomes invalid, or phase remains `LM DESCENT`. |
| M-LM-04 | Click `CSM` after LM ascent. | Vehicle changes to CSM, phase/log show `CSM ACTIVE`, and subsequent SPS assists use CSM propellant. | CSM mode still uses LM mass/propellant or loses orbit state. |
| M-LM-05 | Run `LM`, `ASC`, `CSM`, `LM` repeatedly. | Mode changes remain deterministic, meshes remain visible, no old guidance/burn state survives a mode change, and telemetry remains finite. | Repeated switches duplicate meshes, leak stale burns, or corrupt fuel/mass values. |

### Failure States and Guardrails

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-FAIL-01 | Deplete SPS/active engine propellant with a long burn, then request another burn. | Engine stops at zero propellant, telemetry never goes below zero, and the log reports `NO PROP` or an equivalent visible failure. | Propellant becomes negative, engine keeps thrusting, or command fails silently. |
| M-FAIL-02 | Create a suborbital/impacting trajectory by lowering PE below the body radius. | Telemetry clearly shows PE below surface/atmosphere or a warning/failure label; time warp does not hide the hazard. | Hazard is indistinguishable from a safe orbit, or the sim crashes at impact/low altitude. |
| M-FAIL-03 | Try mission commands in invalid order: `PDI` at Earth, `TEI` in LM-only mode, `LOI` before lunar SOI, `ASC` before LM descent. | Each invalid command is rejected or logged with a clear reason; no thrust or impossible vehicle transition occurs. | Command silently executes in the wrong phase/body/vehicle. |
| M-FAIL-04 | Start an auto-burn, then press manual thrust or `STAGE`/`OFF`. | Incompatible assist cancels cleanly or logs a refusal; final thrust/guidance state is unambiguous. | Manual input and assist fight each other or both keep controlling thrust. |
| M-FAIL-05 | Force a bad node: zero delta-v burn, stale node after SOI switch, or node with impossible prediction. | UI shows `NO SOLUTION`, `DV ZERO`, clears the stale node, or refuses execution visibly. | Burn executes with zero/invalid vector or stale body frame. |

### Performance

| ID | Steps | Pass | Fail |
| --- | --- | --- | --- |
| M-PERF-01 | Idle in craft view for 2 minutes at `1x` on a current desktop Chrome or Firefox build. | Average frame rate stays at or above 45 FPS, no multi-second stalls occur, and memory growth remains under 50 MB after initial asset load. | Sustained frame rate below 30 FPS, repeated long tasks, or steady memory leak. |
| M-PERF-02 | Switch to map view, create a maneuver node, adjust it for 60 seconds, then clear it. | Node/orbit redraws remain interactive; input latency is under 100 ms for button presses and keyboard controls. | UI lags, clicks are dropped, or trajectory redraw freezes the page. |
| M-PERF-03 | Coast at high warp in Earth orbit for 5 minutes, then return to `1x`. | Orbit remains bounded/stable within expected numerical tolerance, telemetry remains finite, and controls recover immediately at `1x`. | Warp causes orbit energy blow-up, invalid telemetry, or stuck controls. |
| M-PERF-04 | Run a long Earth-Moon transfer coast with map view open. | Moon, spacecraft, SOI/range, and trajectory continue updating without visible stutter or memory growth over 100 MB. | Transfer coast stalls rendering or memory grows continuously. |

### Browser Compatibility

Run the startup, parking orbit, node create/clear, launch start/abort, and map/camera checks on these targets.

| Browser | Required Result |
| --- | --- |
| Chrome stable on desktop | Full pass; this is the primary development browser. |
| Firefox stable on desktop | Full pass; keyboard, mouse wheel, WebGL, and Web Audio behavior match Chrome. |
| Safari stable on macOS | Full pass where WebGL/Web Audio are available; no Safari-only layout clipping or blocked audio exceptions. |
| Edge stable on Windows | Full pass equivalent to Chrome. |
| Mobile Safari/Chrome | Page loads without crashing, HUD remains readable, and no critical controls overlap; detailed flight controls may be desktop-only until touch controls exist. |

Fail any desktop browser run for unsupported JavaScript syntax, blocked CDN script loading without a clear fallback, WebGL context failure without a visible error, broken keyboard input, or HUD controls overlapping at common 1366x768 and 1920x1080 viewport sizes.

## Automated Test Plan

### Current Automation

| ID | Command | Pass | Fail |
| --- | --- | --- | --- |
| A-CURRENT-01 | `node js/mission-sim-check.js` | All checks print `ok` and the final summary reports all checks passed. | Nonzero exit, any `not ok`, or a failed assertion. |

This checker currently covers mission helper math and formatting without launching the browser: MET/distance formatting, body-frame vector orthonormality, east-vector behavior, Moon circular motion, and the adaptive TLI estimate from a 185 km parking orbit.

### Recommended Node/Unit Coverage

| ID | Target | Pass Criteria |
| --- | --- | --- |
| A-UNIT-01 | `ApolloMission.computeCircularizeDeltaV` | For circular, slower-than-circular, and faster-than-circular states, direction and delta-v match analytic values within 1 m/s. |
| A-UNIT-02 | `ApolloMission.updatePrimaryBody` | Crossing inside/outside the Moon SOI switches body exactly once, logs the correct SOI, and forces warp to `1x`. |
| A-UNIT-03 | `ApolloMission.startFixedBurn` and `updateBurnProgress` | Valid burns reduce propellant and cut off within 0.5 m/s; zero-propellant burns log `NO PROP` and never enable thrust. |
| A-UNIT-04 | `ApolloMission.clearGuidance` | Active guidance/burn/hold state is cleared and thrust is false for every assist type. |
| A-UNIT-05 | `Spacecraft` vehicle modes | `saturn-v`, `csm`, `csm-lm`, `lm-descent`, and `lm-ascent` report valid mass, thrust, Isp, propellant, label, and visible mesh roots. |
| A-UNIT-06 | Stage separation | Each Saturn V stage can separate once; no separation is possible past the last stage; vehicle mode and mass remain valid. |
| A-UNIT-07 | Maneuver math | Planned prograde/normal/radial delta-v produces predicted AP/PE consistent with an independent two-body calculation within 1% or 5 km, whichever is larger. |
| A-UNIT-08 | Time formatting and telemetry safety | Public formatters and telemetry update paths never return `NaN`, `undefined`, raw `Infinity`, or empty strings for finite states. |

### Recommended Browser Automation

Use Playwright or an equivalent browser runner against a local static server. Every browser test should fail on console errors, page errors, request failures for local assets, and visible `NaN`/`undefined`/`Infinity` text.

| ID | Flow | Pass Criteria |
| --- | --- | --- |
| A-BROWSER-01 | Startup smoke | Page loads, WebGL canvas is nonblank, mission panel and node editor are visible, initial state matches `PRELAUNCH`/`EARTH`/`SATURN V`/`IDLE`. |
| A-BROWSER-02 | Launch abort | Click `LAUNCH`, wait for thrust/phase change, click `OFF`; thrust turns off and guidance returns to idle. |
| A-BROWSER-03 | Parking orbit shortcut | Click `ORBIT`; AP and PE text are finite and within 170-200 km after one animation frame. |
| A-BROWSER-04 | Attitude holds | Click each hold button; mission guidance text and log update to the requested hold without console errors. |
| A-BROWSER-05 | Maneuver node editor | Create node, adjust each axis/time control, align, zero, clear; editor/DSKY state follows each action and node clears fully. |
| A-BROWSER-06 | Mission burn cancellation | From parking orbit, click `TLI`, verify burn/guidance state, click `OFF`, verify thrust stops and fuel no longer decreases. |
| A-BROWSER-07 | SOI transition harness | Seed a spacecraft state just outside lunar SOI, step inward, and assert active body/log/warp change; step outward and assert Earth re-entry behavior. |
| A-BROWSER-08 | LM mode cycle | Click `ORBIT`, then `LM`, `PDI`/`OFF`, `ASC`, `CSM`; vehicle labels, phase/log, and propellant pools remain valid. |
| A-BROWSER-09 | Invalid command guards | Try `PDI` at Earth, `LOI` before lunar SOI, `TEI` in LM mode, and a zero-delta-v node burn; each is refused or logged without thrust. |
| A-BROWSER-10 | Responsive layout | Capture screenshots at 1366x768, 1920x1080, and 390x844; required controls are visible, readable, and non-overlapping. |

### Scenario Regression Automation

These longer runs should be deterministic seeded scenarios rather than real-time manual playthroughs.

| ID | Scenario | Pass Criteria |
| --- | --- | --- |
| A-SCEN-01 | Launch-to-parking-orbit ascent | Automated launch/staging reaches an Earth orbit with AP/PE above 160 km, finite propellant state, and no stuck thrust. |
| A-SCEN-02 | Parking orbit to TLI | TLI estimate from 185 km parking orbit is 3100-3170 m/s; executing the burn reduces SPS propellant and produces an Earth escape/lunar-transfer conic. |
| A-SCEN-03 | Lunar SOI and LOI | Seeded translunar state enters Moon SOI, then LOI produces a bound lunar orbit with PE above lunar surface and AP below 400 km. |
| A-SCEN-04 | LM descent/ascent mode safety | Lunar orbit state survives LM descent/ascent/CSM switching; mode-specific propellant and mass remain valid after each switch. |
| A-SCEN-05 | Apollo 13-style contingency hooks | Inject service-module oxygen loss or SPS unavailable state; SPS burns are refused, LM-assisted recovery burns remain available only in LM mode, and logs explain the constraint. |
| A-SCEN-06 | Free-return/coast stability | A seeded free-return trajectory remains finite through Earth/Moon SOI changes and returns to Earth-primary context without runaway energy. |

## Release Gate

- Block release if any startup, launch abort, parking orbit, maneuver node create/clear, mission burn cancel, or browser compatibility smoke check fails.
- Block release if `node js/mission-sim-check.js` fails.
- Block release if a mission assist can burn in an invalid body/vehicle/phase without a visible warning.
- Block release if any user-facing telemetry displays `NaN`, `undefined`, raw `Infinity`, or empty critical readouts during normal play.
- Allow release with known fidelity limitations only when the limitation is documented in `docs/SIM_FIDELITY.md` or `docs/APOLLO_GAMEPLAY.md` and does not contradict the tested behavior.
