# Apollo Game Feel Spec

This document specifies the moment-to-moment feel target for the Apollo sim. It is not a feature backlog or source-code plan. It defines how camera, audio, alerts, mission events, burns, landing, rendezvous, and visual restraint should work together so the simulator feels tense, legible, and satisfying inside the existing MOCR/vector aesthetic.

The desired feel is: Mission Control precision with pilot immediacy. The player should feel that every input has mass, every warning has a reason, and every successful correction earns a quiet little "that was clean" moment.

## Feel Pillars

- **Legibility first**: No cinematic effect may hide the state vector, attitude, fuel, active guidance owner, or hazard.
- **Drama through restraint**: Use timing, silence, panel state, line motion, and procedural tones instead of bloom, camera shake spam, or decorative VFX.
- **Assist transparency**: When guidance helps, the sim should show what it is doing, why it is waiting, what it will touch, and how to cancel it.
- **Earned confidence**: Good execution produces calm, stable, precise feedback. Bad execution produces specific, recoverable pressure before it becomes failure.
- **Apollo texture without cosplay overload**: Use terse flight-controller language, tabular numbers, alarms, and checklists. Avoid fake CRT overlays, smeared glow, and theme-park radio chatter.

## Camera Behavior

### Camera Modes

Use three camera personalities, each with a clear job.

| Mode | Purpose | Feel Target |
| --- | --- | --- |
| `CRAFT` | Hand-flying, burn execution, staging, docking, landing | Close, physical, damped, readable attitude change. |
| `ORBIT` | Understanding trajectory around the active body | Stable local-frame chase view with orbit geometry in view. |
| `MAP` | Planning nodes, transfers, rendezvous phasing, event timing | Orthographic, quiet, information-dense, no cinematic drift. |

Mode changes should be quick but not instant: ease over `0.35-0.6s`, preserve the player's rough target if possible, and avoid snapping through the spacecraft or body.

### Craft Camera

- Default to a slightly aft and above chase angle that shows the vehicle silhouette, thrust axis, navball relationship, and nearby horizon/limb when available.
- Apply damped follow, not rigid lock. Translation should settle over `0.25-0.45s`; rotation should settle over `0.15-0.3s`.
- During manual attitude input, let the craft move first and let the camera catch up. The lag should be visible enough to convey inertia, never enough to make pointing feel mushy.
- During RCS translation, add subtle lateral camera displacement in the direction opposite acceleration. This should feel like a small body-rate cue, not a shake effect.
- During high time warp, remove close camera lag and stabilize against the orbit frame so long coasts look calm.

### Burn Camera

When a burn is armed or active:

- Frame the craft so the thrust axis and maneuver/hold marker are both visible.
- If alignment error is above tolerance, bias the camera toward the attitude error instead of the engine plume.
- On ignition, use a single short impulse: `0.08-0.12s` of micro-shake or field-of-view compression, then settle into a steady burn view.
- On cutoff, let the sudden quiet and HUD residuals carry the moment. Do not add a big camera flourish.
- For long burns, slowly widen the frame enough to keep the predicted path and body limb readable when in `ORBIT` or `MAP`.

### Launch Camera

- Prelaunch: locked low-angle pad view with Saturn V vertical and UI fully readable.
- `T-10s` to ignition: gradual camera tighten and very slight upward tilt; no swaying.
- Liftoff: hold the pad for the first `1-2s` after motion starts, then begin a slow chase climb.
- Max-Q/roll/pitch program: camera should favor the direction of travel and horizon so the gravity turn is understandable.
- Stage separation: briefly widen before separation, hold through event, then reacquire the active stage over `0.5-0.8s`.
- Do not use excessive shake. The Saturn V should feel huge through slow acceleration, low-frequency audio, countdown pressure, and staging timing.

### Landing Camera

- Above `10 km` radar altitude: stay in orbit/descent view with landing site vector and horizontal velocity clear.
- Below `10 km`: bias toward surface-relative framing. The player must read vertical speed, horizontal drift, and attitude.
- Below `500 m`: reduce camera orbit freedom and damp zoom changes so the touchdown zone does not slide away.
- Below `100 m`: keep the LM, velocity vector, and surface horizon in the same composition. Avoid dramatic cuts.
- On touchdown: freeze camera target for `0.5s`, then allow a tiny settle if the landing is safe. Hard landings get a sharper jolt and immediate diagnostic feedback.

### Rendezvous/Docking Camera

- When a target exists inside proximity range, offer or auto-select a relative camera that keeps both active craft and target marker in frame.
- At long range, show line-of-sight vector, range-rate trend, and closest-approach marker more prominently than vehicle detail.
- Inside docking range, the camera should align with the docking axis by default, with manual orbit still available.
- Closing motion should be visually honest. Do not smooth relative position so much that unsafe closure looks safe.

## Audio Cues

All audio should remain procedural through Web Audio. Keep it dry, lo-fi, and sparse. Silence is part of the design.

### Audio Layers

| Layer | Use | Feel |
| --- | --- | --- |
| Ambient bus | Cabin/system hum, coast texture | Nearly subliminal; safe orbit feels calm. |
| Propulsion bus | SPS/DPS/APS/Saturn engines, RCS | Physical, throttle-linked, quick cutoff. |
| Alarm bus | Master alarm, caution ticks, terminal cues | Distinct, rare, never musical. |
| UI bus | Button confirms, checklist ticks, mode changes | Tiny clicks/relays, low volume. |

### Propulsion

- Main engine ignition should have an attack: low rumble ramps over `0.25-0.5s`, with initial transient for ignition.
- Main engine steady-state should vary subtly with throttle, mass, and atmosphere/vehicle context if available.
- Cutoff should be abrupt. The player should notice the silence before reading the residual.
- RCS should be crisp short pops. Rapid translation should become a staccato texture, not a continuous hiss.
- Saturn V launch should be the only place where engine audio is allowed to feel overwhelming, but it must not mask alarms or panel alerts.
- LM DPS should sound thinner and more controllable than Saturn/SPS: less sub-bass, more filtered noise, throttle clearly audible.
- APS ascent should be urgent and short, with a sharper start than DPS.

### Alerts

- `INFO`: no alarm, optional soft relay click.
- `CAUTION`: single short tone or double tick, then visual persistence.
- `WARN`: Apollo-style two-tone master alarm until acknowledged or downgraded.
- `FAIL`: short alarm burst, then silence under the failure summary. Do not loop forever after terminal failure.
- Time-warp forced drop: distinct soft clack, not an alarm unless paired with a hazard.
- Guidance abort by manual input: low click plus event-log entry, no alarm unless it creates a hazard.

### Countdown And Mission Timing

- Use sparse procedural beeps for the final `10s` of launch, maneuver ignition, and docking capture windows.
- The final `3s` before ignition may use a tighter tick cadence if the burn is armed and aligned.
- Do not add spoken countdown unless a future voice system can do it cleanly and sparingly.

## UI Alerts And Annunciators

The MOCR UI should produce pressure through hierarchy and precision, not through noise.

### Alert Hierarchy

| Severity | Visual Treatment | Audio | Player Meaning |
| --- | --- | --- | --- |
| `INFO` | Dim event-log line | Optional click | State changed; no action required. |
| `CAUTION` | Amber/yellow value or thin border | One tick | Watch this; correction may be needed. |
| `WARN` | Sticky header/banner and affected readout | Master alarm | Act now or objective is threatened. |
| `FAIL` | Terminal banner plus cause and restart/retry path | Burst then silence | Objective failed or vehicle lost. |

Alerts must name the system and the remedy in compact language: `WARN SPS RSV LOW`, `CAUTION ALIGN 4.2 DEG`, `FAIL HARD LANDING VS -5.8`.

### Alert Timing

- New warnings should appear within `100 ms` of detection.
- Do not flash continuously. Blink only during the first `1.5s` of a new `WARN` or while a value is actively crossing a redline.
- Sticky hazards stay visible until the condition clears or the player acknowledges a non-active caution.
- Duplicate warnings should update count/latest MET instead of spamming the log.

### Annunciator Feel

- Guidance state should read like a flight-controller board: `ARM`, `ALIGN`, `WAIT`, `BURN`, `CUTOFF`, `ABORT`, `DONE`.
- Values that are improving should have calm stable color. Values trending worse may pulse subtly only near thresholds.
- The UI should never cover the exact thing the player must look at: navball marker, node vector, landing site, docking reticle, or body horizon.

## Launch And Staging Drama

Launch should feel like committing a huge machine to a narrow plan, not pressing a teleport button.

### Prelaunch Commit

- `LAUNCH` enters a committed countdown state before thrust.
- The panel should show `GUID LAUNCH ARM`, then `COUNT T-010`, then `IGNITION`, then `LIFTOFF`.
- Abort/cancel remains available until ignition. After ignition, abort becomes a logged emergency/reset path rather than a casual cancel.
- The spacecraft should not leap from the pad. Hold-down and thrust buildup should last briefly before vertical motion.

### Liftoff And Ascent

- Early ascent should emphasize slow mass and rising confidence: low camera motion, heavy engine audio, increasing velocity readouts.
- Pitch program should be visible through horizon change, navball marker movement, and `GUID PITCH` state.
- Max-Q or equivalent stress point can be represented as a `CAUTION LOAD` band if aerodynamic modeling exists later; without aero, do not fake a major hazard.

### Staging

Staging should be a little ceremonial and very clear.

Sequence target:

1. `STAGE ARM` appears when the current stage is nearly depleted or manual staging is valid.
2. Engine cutoff: audio drops sharply; thrust readout goes to zero.
3. Separation cue: relay clack, brief visual gap, spent-stage marker or log line.
4. Interstage coast: `0.25-0.75s` of quiet tension where appropriate.
5. Next-stage ignition: new propulsion timbre and `STAGE S-II` / `STAGE S-IVB` log.

Manual premature staging should produce a caution before separation when possible. If allowed anyway, the aftermath should be clear: lower acceleration, bad trajectory, or failure risk.

## Burn Execution Feel

Burns are the core tactile reward. They should feel planned, committed, measurable, and correctable.

### Burn Lifecycle

| State | Player Feedback |
| --- | --- |
| `PROPOSED` | Ghost node/path, delta-v cost, burn duration, reserve impact. |
| `ARMED` | TIG countdown, ignition lead, required attitude, cancel affordance. |
| `ALIGN` | Navball marker, alignment error, attitude hold owner. |
| `WAIT` | Stable countdown, warp guard, quiet audio tick near ignition. |
| `BURN` | Remaining delta-v, residual vector, propellant flow, engine sound. |
| `CUTOFF` | Abrupt silence, residual error, resulting orbit flash/update. |
| `TRIM` | Suggested correction if residual exceeds tolerance. |

### Alignment And Ignition

- Alignment marker should feel magnetic when close: under `2 deg`, readout stabilizes and `ALIGN OK` appears.
- Above tolerance, `BURN` should refuse or delay unless the player explicitly overrides.
- Auto-burn should own thrust only during the active burn window. Manual thrust cancels or supersedes with an event log entry.
- Warp must step down before `TIG - burnDuration / 2`, with clear `WRP LOCK BURN` feedback.

### During Burn

- Remaining delta-v should count down smoothly with no jittery formatting.
- Residual vector should shrink in the node editor/navball, not only in a numeric readout.
- Engine audio should communicate whether the engine is still firing before the player reads `THR`.
- Long burns should show midpoint crossing as a small event: `NODE MIDPOINT`.
- If fuel runs low, the UI should shift from normal burn confidence to reserve concern before burnout.

### Cutoff And Result

- A good cutoff should feel crisp: sound stops, `CUTOFF` appears, path redraws, residual is called out.
- Use score bands, not moral language:
  - `BURN NOMINAL`: residual within target tolerance.
  - `TRIM REQ`: residual fixable with small burn.
  - `UNDERBURN` / `OVERBURN`: objective threatened.
- If the predicted orbit changes significantly, animate the path update over a short `0.2-0.4s` reveal so the player sees cause and effect.

## Landing Feedback

Lunar landing should feel like controlled danger: sparse, low-altitude, and brutally legible.

### Descent Readouts

Always prioritize:

- Radar altitude.
- Vertical speed.
- Horizontal speed.
- Throttle / DPS fuel.
- Landing-site range or miss distance.
- Attitude / surface-retrograde cue.
- Abort margin when available.

The panel may hide less relevant orbital readouts below low altitude to keep landing numbers visually dominant.

### Descent Cues

- Radar acquisition should be a clear event: `RADAR ACQ` plus a soft tone.
- Crossing altitude gates should create compact log entries: `10KM`, `1KM`, `500M`, `100M`.
- Unsafe vertical speed should warn early enough to correct, not at impact.
- Horizontal drift should be visible in the landing reticle and not buried in text.
- Fuel low should escalate from `CAUTION DPS 10%` to `WARN DPS 5%` to terminal only when recovery is actually gone.

### Touchdown Classification

Classify touchdown immediately and explain it with numbers.

| Outcome | Feedback |
| --- | --- |
| `SOFT LANDING` | Short settle, engine cutoff, quiet confirmation, touchdown MET and fuel. |
| `FIRM LANDING` | Safe but imperfect; show vertical/horizontal speed and margin. |
| `HARD LANDING` | Jolt, alarm burst, cause line: vertical speed, horizontal speed, or attitude. |
| `TIPOVER` | Delayed failure if attitude/slope exceeds tolerance after contact. |
| `IMPACT` | Immediate terminal event, no celebratory motion. |

A safe landing should feel almost strangely quiet after the burn: the reward is stable numbers, no alarm, and the surface state holding.

## Rendezvous Feedback

Rendezvous should make invisible orbital mechanics feel like a tightening conversation between two vectors.

### Relative State

When a rendezvous target exists, make these values first-class:

- Range.
- Range rate.
- Relative velocity.
- Closest approach distance and time.
- Phase angle.
- Line-of-sight rate.
- Alignment/capture status inside docking range.

The sim should distinguish "getting closer" from "getting safer." Closing range with bad relative velocity should feel tense, not successful.

### Phasing And Intercept

- Show suggested correction burns as small, named opportunities: `CSI`, `CDH`, `TPI`, `TRIM`.
- A good rendezvous plan should make the closest-approach marker visibly converge over time.
- When the player improves the intercept, the UI should acknowledge it quietly: `CA 12.4KM -> 1.8KM`.
- If the target is drifting out of plane or phase, warn with the cause: `CAUTION PLANE ERR`, `WARN CLOSING FAST`.

### Proximity Operations

- Inside `1 km`, emphasize range rate and line-of-sight motion over orbital elements.
- Inside docking distance, provide a reticle with:
  - Relative lateral offset.
  - Closing speed band.
  - Docking-axis alignment.
  - Capture cone/tolerance.
- RCS audio should become the main tactile feedback. Each pulse should correspond to visible relative motion over time.
- Soft capture gets a small mechanical click and `SOFT DOCK`.
- Hard dock follows only after alignment/rate criteria remain stable briefly: `HARD DOCK`.
- Unsafe contact should report the actual offender: `FAIL DOCK RATE`, `FAIL DOCK ALIGN`, or `FAIL COLLISION`.

## MOCR / Vector Aesthetic Restraint

The sim's identity is black field, green vector lines, thin borders, tabular numerics, and operational language. Polish should sharpen that identity, not cover it.

### Do

- Use crisp lines, stable grids, simple markers, and high-contrast readouts.
- Keep UI text uppercase, terse, and testable.
- Use color sparingly: green/white for nominal, dim green for inactive, amber for caution, red only if the palette adds a true terminal color later.
- Let geometry explain motion: trajectory lines, velocity vectors, reticles, countdowns, residuals.
- Use small procedural sounds and sudden silence as drama.
- Prefer one strong event cue over many decorative cues.

### Do Not

- Do not add bloom, lens flare, chromatic aberration, CRT scanlines, VHS noise, particle confetti, or screen grime.
- Do not add big camera shake except as a tiny ignition/contact accent.
- Do not hide precision readouts behind cinematic overlays.
- Do not use verbose tutorial text in the live cockpit/panel layer.
- Do not fake Apollo authenticity with constant voice chatter. Silence and sparse alarms are more powerful.
- Do not make every alert blink. If everything shouts, the player stops hearing the spacecraft.

## Implementation Acceptance Checks

A future implementation satisfies this spec when the following feel checks pass:

- A new player can tell whether guidance is idle, aligning, waiting, burning, or aborted without reading source code or logs.
- A burn produces a readable loop: plan, align, countdown, ignition, residual shrink, cutoff, result.
- Launch has at least three distinct emotional beats: commit, liftoff, staging.
- A safe landing feels quiet and precise; a bad landing names the exact numeric cause.
- Rendezvous feedback makes range-rate and closest approach more important than spectacle.
- Audio can be disabled without breaking state legibility, and visuals can be read without audio.
- The screen still looks like the same MOCR/vector simulator after all polish is added.
