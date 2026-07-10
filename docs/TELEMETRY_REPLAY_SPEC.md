# Telemetry Recording And Replay Spec

This spec defines the operator UX and engineering contract for recording, exporting, replaying, and debriefing Apollo mission telemetry. It extends the current `ApolloTelemetryRecorder` helper without moving simulation ownership out of `Scene`, `ApolloMission`, or `Spacecraft`.

## Goals

- Make every mission attempt reviewable after success, failure, abort, or manual stop.
- Support lightweight CSV export for spreadsheets and regression captures.
- Provide a replay mode that scrubs recorded telemetry without mutating live physics state.
- Produce a mission debrief with timeline events, extrema, phase outcomes, and chart/readout summaries.
- Keep the recorder cheap enough to run during normal play, high time warp, and automated checks.

## Non-Goals

- Replaying full deterministic physics from control inputs.
- Serializing full Three.js scene state, meshes, particles, audio, or camera state.
- Replacing the mission log, failure system, maneuver-node executor, or save/checkpoint system.
- Building a forensic black box for every internal variable. Replay is a player-facing and QA-facing telemetry review, not a byte-perfect simulation restore.

## Operator UX

### Recording Lifecycle

Recording is automatic for Apollo sessions:

1. Start a new recording when `ApolloMission` enters `PRELAUNCH`, a scenario is loaded, or the player explicitly presses a future `RESET`/`RESTART`.
2. Append samples on a fixed cadence while the sim is active.
3. Add event markers when mission log rows, failure events, checklist completions, vehicle switches, guidance starts/stops, SOI switches, staging, docking, landing, splashdown, or scenario outcome changes occur.
4. Mark the recording complete when the scenario succeeds, fails, aborts, or the player opens the debrief.
5. Keep the last completed recording available until a new session starts.

The UI should expose a compact `REC` status in the Apollo mission panel or debrief entry point:

| State | Display | Behavior |
| --- | --- | --- |
| Idle | `REC STBY` | Recorder exists but has no active samples. |
| Active | `REC 00:12` | Samples are being captured; elapsed wall-clock recording time or sample count can be shown. |
| Paused | `REC HOLD` | Capture is temporarily stopped while menus, replay, or non-sim modal UI is active. |
| Complete | `REC DONE` | Recording is sealed for debrief/export. |
| Error | `REC FAIL` | Sampling or export failed; live sim must continue. |

Recording controls should be minimal:

- `DEBRIEF`: opens the mission debrief for the latest active or completed recording.
- `EXPORT CSV`: downloads or copies the current CSV export.
- `EXPORT JSON`: optional structured export for bug reports and future replay import.
- `CLEAR`: clears the retained recording after confirmation.

Do not ask the player to manually start recording for normal Apollo scenarios. Manual controls are for review/export, not for basic capture.

### Replay Mode

Replay is a read-only review surface. Entering replay must pause live simulation advancement, disable mission assists, and clearly show `REPLAY` so the player does not confuse recorded state with flyable state.

Required replay controls:

| Control | Behavior |
| --- | --- |
| Play/Pause | Advances through recorded samples at selected replay speed. |
| Scrub timeline | Jumps to nearest sample by mission elapsed time. |
| Step back/forward | Moves one sample or one event marker. |
| Speed | `0.25x`, `0.5x`, `1x`, `2x`, `5x`, `10x` replay speed, independent of sim time warp. |
| Event list | Jumps to mission events, failures, staging, SOI switches, burns, and checklist transitions. |
| Exit replay | Returns to the paused live sim or completed debrief without applying recorded values to physics objects. |

Replay presentation should reuse existing mission-control styling:

- Main chart area for selected telemetry traces.
- Timeline rail with phase bands and event ticks.
- Current sample readout for MET, phase, active body, vehicle, altitude, velocity, fuel, mass, warp, guidance state, and warning state.
- Optional map ghost path rendered from recorded positions once position vectors are added to the schema.
- Event detail drawer for failure/recovery context and the nearest telemetry snapshot.

Replay must not call `spacecraft.applyThrust`, mutate `spacecraft.position`, write to `mission.phase`, change `scene.primaryBody`, start audio, or trigger guidance. It should render from a replay snapshot model owned by the replay UI.

## Sample Schema

The current `ApolloTelemetryRecorder` sample is the v1 minimum. Future fields should be additive, SI-unit based unless the name says otherwise, and safe to serialize as JSON.

```js
{
  schemaVersion: 1,
  sampleId: 42,
  missionTimeS: 742.25,
  wallTimeMs: 1713974012345,
  phase: "PARKING",
  body: "Earth",
  vehicle: "CSM+LM",
  vehicleMode: "csm-lm",
  guidance: {
    owner: "mission",
    state: "TLI",
    mode: "prograde",
    alignmentErrorDeg: 1.8,
    remainingDvMps: 1240.5,
    nodeId: null,
    tigS: null
  },
  orbit: {
    apoapsisM: 188000,
    periapsisM: 181000,
    eccentricity: 0.00052,
    timeToApoapsisS: 1580,
    timeToPeriapsisS: 2190
  },
  kinematics: {
    altitudeM: 185240.4,
    speedMps: 7794.2,
    verticalSpeedMps: 2.1,
    horizontalSpeedMps: 7794.0,
    positionM: { x: 123.4, y: 6500000.1, z: -42.0 },
    velocityMps: { x: 0.2, y: -4.1, z: 7794.2 }
  },
  resources: {
    fuelPercent: 87.4,
    spsFuelPercent: 91.2,
    rcsFuelPercent: 64.7,
    dpsFuelPercent: null,
    apsFuelPercent: null,
    massKg: 43800.5,
    reserveDvMps: 1820
  },
  controls: {
    timeWarp: 1,
    mainThrustOn: false,
    rcsThrustOn: false,
    throttlePercent: 0,
    sasOn: true
  },
  warnings: [
    {
      id: "periapsis-low",
      severity: "warning",
      state: "raised"
    }
  ],
  eventIds: ["event-0018"]
}
```

### Field Rules

- `schemaVersion`: integer; increment only for breaking import semantics. Additive fields keep the same major version.
- `sampleId`: monotonic integer within one recording. Current recorder field `i` maps here.
- `missionTimeS`: mission elapsed time in seconds. Current recorder field `t` maps here.
- `wallTimeMs`: local capture timestamp for debugging cadence; not used for mission scoring.
- `phase`, `body`, `vehicle`: player-facing labels. Current recorder fields map directly.
- `vehicleMode`: stable runtime mode such as `saturn-v`, `csm-lm`, `csm`, `lm-descent`, `lm-ascent`, or `cm`.
- `guidance`: current guidance owner/state/readiness. Values may be null when no guidance owner exists.
- `orbit`: active-primary-body orbital readouts, finite when available.
- `kinematics`: active-primary-body or inertial readouts. Position and velocity vectors are optional until the runtime exposes stable real-world vectors.
- `resources`: propellant and mass values. Unknown values are `null`, not `0`.
- `controls`: operator/autopilot state that explains why a value changed.
- `warnings`: active unresolved warning summaries for the sample.
- `eventIds`: ids of structured events raised exactly at this sample.

Never emit `NaN`, `Infinity`, `undefined`, or empty objects. Use `null` for unknown numeric values and empty arrays for no warnings/events.

### Recording Envelope

For JSON export and replay import, samples should be wrapped in an envelope:

```js
{
  schemaVersion: 1,
  recordingId: "apollo-11-2026-04-24T16-12-03Z",
  createdAt: "2026-04-24T16:12:03.000Z",
  appVersion: "local",
  scenarioId: "apollo-11",
  profileId: "apollo-11",
  recorder: {
    sampleRateHz: 2,
    maxSamples: 7200,
    droppedSamples: 0
  },
  start: {
    phase: "PRELAUNCH",
    body: "Earth",
    vehicle: "Saturn V"
  },
  outcome: {
    state: "failed",
    reason: "lunar-impact",
    missionTimeS: 349821.5
  },
  events: [],
  samples: []
}
```

The envelope is the replay unit. A replay import should reject unknown breaking schema versions, tolerate missing optional fields, and report a readable validation error instead of partially entering replay.

## CSV Export

CSV is the compatibility format for spreadsheets, QA attachments, and quick diffing. It should remain flat, stable, and small. The existing `ApolloTelemetryRecorder.exportCSV()` columns are the v1 CSV baseline:

| Recorder key | CSV column | Unit/format |
| --- | --- | --- |
| `i` | `sample` | integer |
| `t` | `mission_time_s` | seconds |
| `phase` | `phase` | text |
| `body` | `body` | text |
| `vehicle` | `vehicle` | text |
| `alt` | `altitude_m` | meters |
| `vel` | `velocity_mps` | meters per second |
| `fuel` | `fuel_percent` | percent |
| `sps` | `sps_fuel_percent` | percent |
| `rcs` | `rcs_fuel_percent` | percent |
| `mass` | `mass_kg` | kilograms |
| `warp` | `time_warp` | multiplier |
| `thrust` | `thrusting` | `1` or `0` |
| `rcsOn` | `rcs_thrusting` | `1` or `0` |

Add new CSV columns only at the end to avoid breaking saved spreadsheet templates. Recommended next columns:

```text
schema_version,wall_time_ms,vehicle_mode,guidance_owner,guidance_state,
alignment_error_deg,remaining_dv_mps,apoapsis_m,periapsis_m,eccentricity,
time_to_apoapsis_s,time_to_periapsis_s,vertical_speed_mps,
horizontal_speed_mps,throttle_percent,sas_on,warning_count,event_ids
```

CSV rules:

- Include one header row.
- Encode booleans as `1`/`0`.
- Encode arrays as semicolon-delimited ids in one cell.
- Leave unknown numeric values blank.
- Quote cells containing commas, quotes, CR, or LF.
- Preserve raw SI values; unit conversion belongs in the UI or spreadsheet.
- Do not localize decimal separators or date formats.

Example:

```csv
sample,mission_time_s,phase,body,vehicle,altitude_m,velocity_mps,fuel_percent,sps_fuel_percent,rcs_fuel_percent,mass_kg,time_warp,thrusting,rcs_thrusting
1,0,PRELAUNCH,Earth,Saturn V,0,0,100,100,100,2900000,1,0,0
2,10,LAUNCH,Earth,Saturn V,510.2,102.7,99.8,100,99.9,2897200,1,1,0
```

## Mission Debrief

The debrief is a structured review generated from the recording envelope, structured events, and extrema. It should be available after terminal outcomes and manually from `DEBRIEF`.

### Debrief Layout

1. Header: scenario/profile label, outcome, MET, active body, vehicle, and recording duration.
2. Score summary: objective pass/fail/partial states, required reserves, landing/docking/entry classifications when available.
3. Timeline: phase bands, burns, staging, SOI switches, failures, checklist completions, and terminal outcome.
4. Key readouts: min/max altitude, max velocity, fuel at start/end/min, mass at major events, max warp, total recorded burn time, total RCS activity time.
5. Charts: selectable traces with event markers.
6. Event review: structured failure/warning log with cause, consequence, trigger values, recovery actions, and nearest before/after samples.
7. Export actions: CSV, JSON, and future screenshot/report copy.

### Debrief Metrics

Minimum computed metrics:

- `durationMissionTimeS`: last sample mission time minus first sample mission time.
- `sampleCount` and `effectiveSampleRateHz`.
- `minAltitudeM`, `maxAltitudeM`, and sample ids.
- `maxVelocityMps` and sample id.
- `fuelStartPercent`, `fuelEndPercent`, `fuelMinPercent`, and propellant deltas by pool.
- `burnTimeS`: accumulated sample intervals where `mainThrustOn` is true.
- `rcsActiveTimeS`: accumulated sample intervals where `rcsThrustOn` is true.
- `maxWarp`.
- `eventCountsBySeverity`.
- `terminalEventId` when outcome is failed or succeeded by a named event.

For v1, `ApolloTelemetryRecorder.getMinMaxSnapshots()` already provides altitude, velocity, and fuel extrema. The debrief builder should use those when available and compute additional metrics from the sample array.

### Outcome Language

Debrief text should be concise and causal:

- Success: `MISSION COMPLETE - TEI and recovery objectives satisfied`.
- Recoverable failure: `MISSION ABORTED - SPS propellant below return reserve`.
- Terminal failure: `MISSION FAILED - lunar impact at 00:00:00 MET`.
- Manual stop: `MISSION ENDED - player opened debrief before terminal outcome`.

Avoid implying historical precision beyond the sim. The copy should say what happened in this run and which telemetry values caused the result.

## Charts And Readouts

### Required Charts

| Chart | Traces | Notes |
| --- | --- | --- |
| Altitude | altitude, apoapsis, periapsis | Use active body phase bands because Earth and Moon altitude ranges differ. |
| Velocity | speed, vertical speed, horizontal speed | Vertical/horizontal traces appear when sampled. |
| Propellant | total fuel, SPS, RCS, DPS, APS | Hide missing pools instead of plotting zero. |
| Guidance | remaining delta-v, alignment error | Show burn windows and cutoff events. |
| Mass/warp | mass, time warp | Useful for staging and high-warp regression review. |

### Readout Behavior

- Hovering a chart shows the nearest sample values and event ids.
- Scrubbing updates all readouts from the same sample.
- Phase changes and events should be vertical markers with compact labels.
- Missing values render as gaps, not zero lines.
- Large ranges should use readable units in the UI (`km`, `m/s`, `km/s`, `%`) while retaining SI values internally.
- The chart library or custom renderer must support at least 7,200 samples without layout thrash.

### Timeline Bands

Phase bands should use stable phase ids when available and fall back to labels:

```text
PRELAUNCH -> LAUNCH -> PARKING -> TLI -> TRANSLUNAR -> LUNAR_SOI
-> LOI -> LUNAR_ORBIT -> LM_DESCENT -> SURFACE -> LM_ASCENT
-> RENDEZVOUS -> TEI -> ENTRY -> COMPLETE
```

The timeline should tolerate skipped or repeated phases. Repeated phases get separate bands with the same label and different time ranges.

## Performance Budget

Telemetry must be always-on without becoming a frame-time feature.

| Area | Budget |
| --- | --- |
| Sampling cadence | Default 2 Hz at `1x`; up to 10 Hz for focused QA captures; event samples captured immediately. |
| Per-sample CPU | Under 0.25 ms average on a midrange laptop. |
| Per-frame overhead | No allocations or DOM work from recorder during frames that do not sample. |
| Active memory | Under 5 MB for a 60 minute 2 Hz recording with v1 sample fields and events. |
| Export time | CSV export under 100 ms for 7,200 samples; JSON export under 250 ms. |
| Replay scrub latency | Under 16 ms to update readouts and charts for a sample jump. |
| Chart render | First render under 250 ms for 7,200 samples; subsequent scrub updates under 16 ms. |

Sampling policy:

- Use elapsed mission time accumulation rather than `setInterval`, so capture follows the sim loop and can record high-warp behavior consistently.
- Clamp pathological catch-up. If a frame spans many sample intervals, capture at most one regular sample plus any event samples, then increment `droppedSamples`.
- Always capture an immediate sample for important events, even if the regular cadence has not elapsed.
- Keep recorder reads side-effect free. Any getter that can throw or produce non-finite values should be guarded and converted to `null`.
- Defer CSV/JSON string construction until export; do not maintain serialized copies every sample.
- Consider a ring buffer for live recording and a sealed array for completed debriefs. If the session exceeds `maxSamples`, note truncation in the debrief and export envelope.

## Integration With ApolloTelemetryRecorder

The existing `js/apolloTelemetryRecorder.js` should remain the low-level sampler/export helper. It already:

- Accepts `maxSamples`.
- Provides `record(scene, mission, spacecraft)` and `sample(...)`.
- Produces defensive sample clones.
- Exposes `getSamples()`, `getLatestSample()`, `getMinMaxSnapshots()`, `getStats()`, `setMaxSamples()`, `clear()`, and `reset()`.
- Exports v1 CSV through `exportCSV()`/`toCSV()`.
- Reads scene, mission, and spacecraft defensively without owning them.

### Proposed Runtime Owner

Add a thin mission-owned integration layer when implementation begins:

```js
class ApolloTelemetrySession {
  constructor(recorder, options) {}
  start(metadata) {}
  update(deltaTime, scene, mission, spacecraft) {}
  captureEvent(eventRecord, scene, mission, spacecraft) {}
  complete(outcome) {}
  buildDebrief() {}
  exportCSV() {}
  exportJSON() {}
}
```

Ownership rules:

- `ApolloTelemetryRecorder` samples fields and exports flat CSV.
- `ApolloTelemetrySession` owns cadence, metadata, structured events, outcome, dropped-sample counts, and debrief generation.
- `ApolloMission` decides when the session starts/stops and forwards mission/failure/checklist events.
- Replay/debrief UI consumes a sealed recording envelope and never reads live mutable scene objects.

### Field Mapping

Map current recorder fields into the v1 replay schema:

| Current field | Replay field |
| --- | --- |
| `i` | `sampleId` |
| `t` | `missionTimeS` |
| `phase` | `phase` |
| `body` | `body` |
| `vehicle` | `vehicle` |
| `alt` | `kinematics.altitudeM` |
| `vel` | `kinematics.speedMps` |
| `fuel` | `resources.fuelPercent` |
| `sps` | `resources.spsFuelPercent` |
| `rcs` | `resources.rcsFuelPercent` |
| `mass` | `resources.massKg` |
| `warp` | `controls.timeWarp` |
| `thrust` | `controls.mainThrustOn` |
| `rcsOn` | `controls.rcsThrustOn` |

The next recorder expansion should add optional readers for mission snapshot data already proposed in `MISSION_PANEL_SPEC.md`: orbit, target, guidance, resources, checklist, warnings, and events. Prefer one mission snapshot read over many DOM reads.

### Event Integration

The failure system and mission log should emit structured events once per transition:

```js
{
  id: "sps-propellant-low",
  instanceId: "sps-propellant-low-0004",
  severity: "warning",
  category: "resources",
  phase: "TLI",
  met: 847.2,
  body: "Earth",
  vehicle: "CSM+LM",
  headline: "SPS propellant below reserve",
  triggerSnapshot: { spsFuelPercent: 12.4, reserveDvMps: 210 },
  state: "raised"
}
```

`ApolloTelemetrySession.captureEvent()` should append the event, record an immediate sample, and attach the event id to that sample. If the same event changes state, append a new event transition with the same `instanceId`.

### Replay Adapter

Replay should use an adapter that normalizes old and new recordings:

```js
function normalizeTelemetryRecording(input) {
  return {
    schemaVersion: 1,
    metadata: {},
    events: [],
    samples: input.samples.map(normalizeSample)
  };
}
```

The adapter should support:

- Current bare `ApolloTelemetryRecorder.getSamples()` arrays.
- Future recording envelopes.
- CSV imports only if a parser is added; JSON is the preferred replay import format.

## Validation And Tests

Automated checks:

- Recorder samples never contain `NaN`, `Infinity`, or `undefined`.
- CSV header matches the documented v1 baseline.
- CSV escaping handles commas, quotes, and newlines in phase/body/vehicle labels.
- `getMinMaxSnapshots()` matches metrics computed from the sample array.
- Event capture creates an immediate sample and attaches the event id.
- Replay normalization accepts current recorder samples and future envelopes.
- Replay mode does not call live mission, scene, or spacecraft mutation methods.

Manual checks:

- Run a launch-to-parking session, open debrief, and verify altitude/velocity/fuel charts.
- Trigger a warning/failure and verify the event appears on the timeline with nearest telemetry.
- Export CSV and open it in a spreadsheet; headers and numeric values should be usable without cleanup.
- Scrub replay across a phase transition and verify mission panel readouts update from recorded samples only.
- Run five minutes at high warp and confirm sample count, dropped-sample count, and UI responsiveness stay within budget.

## Rollout Plan

1. Keep the existing `ApolloTelemetryRecorder` API stable and add optional fields only after tests cover the current CSV baseline.
2. Add `ApolloTelemetrySession` as the integration owner for cadence, envelope metadata, events, and debrief metrics.
3. Wire `ApolloMission` to start/update/complete the session and forward structured events.
4. Build the debrief view from sealed recordings, starting with readouts, timeline, CSV export, and extrema.
5. Add charts and replay controls after the normalized replay adapter exists.
6. Add JSON export/import for bug reports and replay sharing.

## Open Questions

- What default retention limit should long free-play sessions use: ring-buffer only, full-session JSON, or prompt on terminal outcome?
- Should debriefs be saved in browser storage, or remain in memory until page refresh?
- Which chart renderer should be used once sample counts exceed simple SVG comfort ranges?
- Should replay include camera bookmarks, or keep camera state separate from telemetry?
- How should multiplayer/shared challenge submissions sign or validate telemetry to discourage hand-edited exports?
