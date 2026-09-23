# Earth Entry System Spec

## Purpose

Earth entry should be the playable final exam for Apollo return missions: readable before commitment, tense during atmospheric flight, and scored at splashdown. The system is not a full CFD or 6DOF entry simulator. It is a gameplay layer that turns the Earth-return state vector into corridor classification, command-module control choices, heating and g-load feedback, and recovery scoring.

The authoritative helper for entry classification is `ApolloEntryGuidance` in `js/apolloEntryGuidance.js`. Runtime systems should feed it predicted entry state and consume its returned bands, scores, and cues instead of duplicating thresholds in UI or mission code.

## Design Goals

- Make Earth entry legible before entry interface, especially the tradeoff between shallow skip-out and steep overload.
- Give the player a small but meaningful control surface: final corridor trims before interface, service-module separation, command-module attitude hold, and bank/lift choices after interface.
- Keep prediction and scoring deterministic so tutorials, scenarios, and failure predicates can share the same outcomes.
- Let the entry phase stand alone as a challenge while also integrating cleanly into Apollo 8, Apollo 11, and Apollo 13 return flows.
- Prefer qualitative Apollo-like behavior over hidden numerical precision. The player should know what is wrong and what action can still help.

## Key Terms

| Term | Meaning |
| --- | --- |
| Entry interface | The atmospheric handoff altitude. The helper uses `121920 m`; mission displays may round this to `122000 m` or `122 km`. |
| Flight-path angle | Earth-relative descending angle at entry interface. Negative values are descending. |
| Predicted periapsis | Earth-relative periapsis altitude of the return trajectory, used as a readable proxy for entry steepness. |
| Corridor | The combined periapsis and flight-path-angle band: skip-out, shallow, target, flyable, steep, or overload. |
| Lift state | A command-module bank abstraction that biases range, skip risk, and loads without modeling full aerodynamics. |
| Heating index | Normalized qualitative heat-load estimate returned by `ApolloEntryGuidance.estimateEntryLoads`. |
| Peak g | Estimated maximum crew deceleration in Earth g units. |
| Splashdown error | Distance from the active recovery target or recovery ellipse center. |

## Player Flow

1. **Return corridor acquisition**
   - Starts after TEI or after any free-return/correction burn that produces an Earth intercept.
   - The mission panel shows predicted Earth periapsis, entry-interface flight-path angle, corridor band, load estimate, and splashdown estimate.
   - The player can plan or execute small entry-corridor trim burns while propellant, time, and vehicle configuration allow it.

2. **Entry preparation**
   - Begins when Earth entry interface is predicted and the command/service module is close enough that the next major objective is entry.
   - Checklist gates include command-module power, recovery systems armed, service-module separation readiness, and heat-shield orientation.
   - Time warp must stop before service-module separation and before entry interface.

3. **Entry interface**
   - Triggers when Earth-relative altitude crosses the entry-interface altitude while descending.
   - The simulator snapshots the entry state, locks out large trajectory corrections, and switches from conic prediction to entry-phase evaluation.
   - If the service module is still attached, the command module is not available, or the heat shield is not oriented into the velocity vector, warnings escalate immediately.

4. **Heating, blackout, and range control**
   - The command module rides through a scripted energy-loss phase driven by the classified corridor, speed, lift state, and attitude error.
   - Heating, g-load, and blackout cues rise and fall over time. The predicted peak values remain visible so the player can compare live readings to forecast.
   - Bank/lift commands can stretch or shorten range and nudge skip/load risk, but cannot rescue a wildly invalid corridor after interface.

5. **Parachute descent**
   - Drogues and mains become available only after speed and altitude enter safe deployment windows.
   - Unsafe deployment can tear canopies, destabilize the command module, or leave too little time for recovery.

6. **Splashdown and recovery**
   - Touchdown resolves crew survival, distance from target, recovery band, remaining RCS/control margin, and final score.
   - Successful scenarios end with a survivable command-module water landing. Mission profiles may decide whether a contingency or remote recovery is partial success or failure.

## Entry Interface Contract

The predictor should create an `entryPrediction` whenever the active Earth-relative trajectory intersects the entry-interface sphere or has an Earth periapsis low enough to be relevant.

Required prediction fields:

| Field | Units | Notes |
| --- | --- | --- |
| `periapsisAltitudeM` | m | Earth-relative periapsis altitude. Use `NaN` only when no usable Earth-return conic exists. |
| `flightPathAngleDeg` | deg | Predicted angle at entry interface; descending is negative. |
| `entryInterfaceAltitudeM` | m | Use the helper/default value or the rounded mission constant consistently in display. |
| `timeToEntryInterfaceS` | s | Drives event-stop and checklist timing. |
| `speedAtEntryInterfaceMps` | m/s | Used by live entry visuals and parachute safety, not by the current helper. |
| `predictedSplashdown` | km or coordinates | Range/cross-range error or `latDeg`/`lonDeg`. |
| `splashdownTarget` | coordinates | Active recovery target for the scenario. |
| `confidence` | enum | `high`, `medium`, `low`, or `unknown`; low confidence should be displayed clearly. |

At interface, persist an immutable `entrySnapshot` for scoring and logs. Live bank/lift commands may modify the live entry state and splashdown prediction, but the initial snapshot remains available for debriefing.

## Corridor Model

Use `ApolloEntryGuidance.classifyEntryCorridor(entry, options)` for all displayed corridor labels, severity, cues, and corridor score.

Default target:

| Target | Value |
| --- | --- |
| Periapsis altitude | `38000 m` |
| Flight-path angle | `-6.45 deg` |
| Periapsis tolerance | `12000 m` |
| Flight-path-angle tolerance | `0.45 deg` |

Default bands:

| Band | Trigger | Gameplay meaning |
| --- | --- | --- |
| `skip-out` | Periapsis `>= 80000 m` or angle `> -5.2 deg` | Atmospheric capture is not reliable. Correct before interface or use aggressive lift-down only for near misses. |
| `shallow` | Periapsis `> 60000 m` or angle `> -5.6 deg` | Capture is likely, but range overshoot and skip risk are elevated. |
| `target` | Periapsis `32000-48000 m` and angle `-6.8` to `-6.0 deg` | Centered Apollo-style target corridor. |
| `flyable` | Periapsis `25000-60000 m` and angle `-7.2` to `-5.6 deg` | Survivable but off-center. Score is capped below target. |
| `steep` | Periapsis `12000-25000 m` or angle `-8.0` to `< -7.2 deg` | Heating, crew load, and undershoot risk are high. |
| `overload` | Periapsis `< 12000 m` or angle `< -8.0 deg` | Entry is outside the preferred crew and thermal envelope. |

Pre-interface corridor state is advisory unless a scenario sets a hard deadline. At entry interface, `target`, `flyable`, `shallow`, and `steep` can proceed into atmospheric evaluation, while `skip-out` and `overload` should escalate to critical failure risk immediately. A near-edge `skip-out` may still produce a recoverable skip/long-range outcome if lift-down is selected quickly; a deep `overload` should fail from thermal or crew-load limits.

## Lift and Skip Abstraction

The command module gets a simplified bank/lift model after entry interface. It should feel like range-control guidance, not aircraft flight.

Bank modes:

| Mode | Effect | Cost/Risk |
| --- | --- | --- |
| `neutral` | Baseline helper prediction. | Lowest RCS/control cost. |
| `lift-up` | Extends range, reduces peak g/heating slightly, increases skip risk. | Bad choice near shallow/skip-out edge. |
| `lift-down` | Shortens range, improves atmospheric capture, increases peak g/heating. | Bad choice near steep/overload edge. |
| `bank-left` / `bank-right` | Adds cross-range bias and modest range correction. | Uses RCS and can increase attitude error if overused. |
| `bank-reversal` | Cancels or reverses cross-range trend. | Costs RCS/control margin and should be rate-limited. |

Recommended internal state:

| State | Meaning |
| --- | --- |
| `energyIndex` | Normalized remaining entry energy, starts near `1` at interface and trends to `0` before chute descent. |
| `captureIndex` | Increases as drag commits the CM to descent. Shallow entries with high lift can drop below capture threshold and skip. |
| `rangeBiasKm` | Accumulates range change from lift-up/lift-down and bank timing. |
| `crossRangeBiasKm` | Accumulates lateral displacement from bank-left/right. |
| `controlMargin` | RCS and attitude stability budget for bank changes and heat-shield pointing. |

Skip-out resolution:

- If altitude rises back above entry interface with positive vertical speed while `energyIndex` remains high and `captureIndex` is below threshold, classify as `skip-out`.
- A shallow but captured entry may produce a long blackout gap, low heating, and remote/contingency splashdown instead of immediate crew loss.
- A skipped command module may be terminal for most scenarios because recovery timing and landing footprint are lost, even if the craft remains physically intact.

Lift should update splashdown prediction and live load estimates during entry. It should not rewrite the original orbital prediction or silently move the pre-entry corridor score.

## Heating, G-Load, and Blackout Feedback

Use `ApolloEntryGuidance.estimateEntryLoads(entry, options)` for the pre-entry load forecast and as the baseline for live entry curves.

Returned load fields:

| Field | Meaning |
| --- | --- |
| `heatingIndex` | Normalized total thermal severity estimate. |
| `heatRateIndex` | Normalized peak heat-rate estimate. |
| `peakG` | Estimated peak deceleration. |
| `heating` | Classified heat band: low, nominal, elevated, high, extreme. |
| `gLoad` | Classified g band: light, nominal, firm, high, critical. |

Feedback rules:

- Show predicted peak heating and peak g before interface and keep them visible through blackout.
- During entry, animate live heating and g-load toward the forecast peak using altitude, speed, and energy curves.
- `elevated` heat or `firm` g is caution styling. `high` heat or `high` g is warning styling. `extreme` heat or `critical` g is critical styling and may become terminal if sustained.
- Blackout is expected during peak heating. It should interrupt comm/telemetry flavor, not hide required safety information from the player.
- Attitude error increases heat-shield risk and can turn a nominal corridor into a burn-up failure.
- Lift-down increases predicted and live load; lift-up reduces load but increases skip/range risk.

Suggested live readouts:

- Corridor band and score.
- Heat gauge with peak marker and heat-shield margin.
- G-load gauge with predicted peak marker.
- Blackout timer or blackout active light.
- Attitude error relative to heat-shield-forward orientation.
- RCS/control margin.
- Predicted splashdown distance and recovery band.

## Splashdown Scoring

Use `ApolloEntryGuidance.scoreSplashdown(predicted, target, options)` for recovery classification and splashdown score.

Default thresholds:

| Band | Distance from target | Score range |
| --- | --- | --- |
| `bullseye` | `<= 15 km` | `95-100` |
| `recovery-zone` | `<= 80 km` | `80-95` |
| `acceptable` | `<= 250 km` | `55-80` |
| `contingency` | `<= 750 km` | `25-55` |
| `remote` | `> 750 km` | `0-25` |

Input may be either:

- `distanceErrorKm`
- `rangeErrorKm` plus `crossRangeErrorKm`
- `latDeg`/`lonDeg` for predicted point plus target `latDeg`/`lonDeg`

Scenario pass/fail:

- Entry tutorial: require survivable splashdown and `acceptable` or better.
- Apollo 8/11 historical return: require survivable splashdown and `recovery-zone` or better for full success; `acceptable` may be partial success if mission scoring supports it.
- Apollo 13: allow `acceptable` or `contingency` recovery if crew survives and consumable constraints were met, because safe return is the primary drama.
- `remote` is a critical recovery outcome and should usually fail scored scenarios even if the CM survives.

Recommended overall entry score:

| Component | Weight | Source |
| --- | --- | --- |
| Corridor quality | 35% | `classifyEntryCorridor().score` |
| Loads and thermal margin | 25% | `estimateEntryLoads()` plus live margin penalties |
| Splashdown accuracy | 25% | `scoreSplashdown().score` |
| Configuration and control margin | 15% | CM mode, SM separation, parachute state, remaining RCS/control |

Hard gates override score: crew loss, burn-up, parachute failure, ground impact, unrecoverable skip-out, or invalid command-module configuration is failure regardless of numerical score.

## Failure States

| Failure id | Trigger | Player feedback | Recovery before terminal |
| --- | --- | --- | --- |
| `entry-no-earth-intercept` | No Earth-interface prediction after TEI/free-return deadline. | `FAIL RETURN MISS` or scenario-specific abort text. | Plan correction burn if propellant and time remain. |
| `entry-corridor-shallow` | Helper returns `skip-out`/`shallow`, or predicted angle is above shallow threshold. | Existing failure catalog: entry angle shallow, skip-out risk, long-range recovery warning. | Lower periapsis or steepen angle with entry-corridor trim; after interface, select lift-down only for near misses. |
| `entry-corridor-steep` | Helper returns `steep`/`overload`, or predicted angle is below steep threshold. | Existing failure catalog: heating and g-load exceed limits. | Raise periapsis or shallow angle before interface; after interface, select lift-up only for near misses. |
| `entry-service-module-attached` | Altitude crosses interface while SM is still attached. | Heat-shield/configuration critical warning. | Separate SM before thermal load rises; fail if still attached at peak heating. |
| `entry-attitude-error` | Heat shield not within safe angular error at interface or during peak heating. | Attitude tape, warning tone, heat-shield margin loss. | Hold retrograde/entry attitude; spend RCS to reduce rates. |
| `entry-control-margin-lost` | RCS/control margin reaches zero during bank/attitude corrections. | Bank commands disabled or attitude hold degrades. | Stop reversals, return to neutral, accept larger landing ellipse. |
| `entry-skip-out` | CM exits atmosphere after shallow pass with too much energy. | Long-range/skip event, recovery footprint lost. | Only recoverable in training variants with a second-pass model; otherwise terminal. |
| `entry-burn-up` | Heat-shield margin reaches zero or extreme heating is sustained. | Thermal critical, blackout/static, crew-loss failure. | None after terminal margin loss; only pre-interface correction or attitude recovery helps. |
| `entry-overload` | Actual or predicted peak g exceeds survivable threshold, especially `>= 12 g`. | Crew-load critical warning and red g gauge. | Shallow before interface or lift-up early; terminal once sustained. |
| `entry-parachute-unsafe` | Drogue/main deployed outside speed/altitude envelope or while configuration is invalid. | Canopy failure or deployment refused. | Wait for envelope if altitude remains; otherwise impact. |
| `entry-impact` | Command module hits water/ground above safe vertical speed or without recovery system. | Terminal landing failure. | Deploy/recover chutes if still within envelope. |
| `entry-remote-recovery` | Splashdown band is `remote` or scenario disallows the final band. | Mission incomplete/recovery critical. | Bank/range correction before chute phase or final pre-entry trim. |

Critical warnings should force time warp to `1x` for active entry, parachute deployment windows, and imminent terminal outcomes.

## Integration With `ApolloEntryGuidance`

Runtime integration should treat the helper as a pure classifier. It does not own spacecraft state, atmospheric stepping, UI, or mission progression.

Prediction update loop:

```js
const entry = {
    periapsisAltitudeM: prediction.periapsisAltitudeM,
    flightPathAngleDeg: prediction.flightPathAngleDeg
};

const splashdown = {
    predicted: prediction.predictedSplashdown,
    target: mission.splashdownTarget
};

const brief = ApolloEntryGuidance.buildEntryBrief(
    entry,
    splashdown,
    { target: mission.entryTarget }
);

const splashdownScore = ApolloEntryGuidance.scoreSplashdown(
    prediction.predictedSplashdown,
    mission.splashdownTarget,
    { thresholds: mission.splashdownThresholds }
);
```

Use `brief.splashdown` when the default recovery thresholds are acceptable. When a scenario overrides recovery thresholds, use the direct `scoreSplashdown` result for final UI and scoring so the override is explicit.

Consumers:

| Consumer | Uses |
| --- | --- |
| Mission panel | `brief.corridor`, `brief.loads`, `brief.splashdown`, and `brief.cues` for labels, gauges, and actionable warnings. |
| Checklist/objectives | Corridor band, CM configuration, SM separation, chute deployment, splashdown band. |
| Failure system | `corridor.id`, `loads.heating.id`, `loads.gLoad.id`, `loads.peakG`, `splashdown.id`, and active configuration flags. |
| Scenario scoring | Corridor score, load penalties, splashdown score, remaining control margin. |
| Telemetry recorder | Entry snapshot, peak observed values, bank commands, failure id, final recovery band. |

Direct helper calls are also useful:

- `classifyEntryCorridor(entry, options)` for pre-entry corridor-only displays.
- `estimateEntryLoads(entry, options)` for peak heat/g forecast.
- `scoreSplashdown(predicted, target, options)` for final scoring or threshold overrides.
- `getGuidanceCues(entry, splashdown, options)` for sorted action prompts.

Do not copy helper thresholds into UI components. If display text needs a threshold, read it from `ApolloEntryGuidance.defaults`, `corridorBands`, `heatingBins`, `gLoadBins`, or `splashdownBands`.

## Mission and UI Hooks

Entry should connect to existing Apollo data as follows:

- `entry-splashdown` checklist owns player-facing step sequencing: corridor check, correction, CM config, SM separation, entry control, drogue, main, splashdown.
- `APOLLO_PROFILES` entry-prep and entry phases provide scenario timing and vehicle mode expectations.
- `APOLLO_FAILURES` already includes `entry-corridor-shallow` and `entry-corridor-steep`; additional failure ids above can be added when runtime entry exists.
- Mission assist commands should expose `CM`, `RET`/entry attitude hold, `OFF`, parachute commands, and bank/lift controls only when valid.
- Time warp event stops must trigger before entry interface, service-module separation deadline, peak-heating window, drogue window, main window, and splashdown.

UI layout requirements:

- Keep entry readouts compact enough for the mission panel: corridor band, periapsis, flight-path angle, predicted peak g, heating band, blackout state, and splashdown distance.
- Map view should show predicted footprint or ellipse with the active recovery target.
- Warnings should be actionable: "Lower periapsis", "Raise periapsis", "Hold corridor", "Protect thermal margin", or "Tighten splashdown".
- Blackout can add static/flavor but must not hide critical controls or failure text.

## Verification Scenarios

Minimum deterministic cases:

| Case | Input | Expected result |
| --- | --- | --- |
| Nominal | Periapsis `38000 m`, angle `-6.45 deg`, target splashdown within `15 km`. | `target` corridor, nominal load bands, bullseye/recovery splashdown, high score. |
| Shallow | Periapsis `70000 m`, angle `-5.4 deg`. | `shallow`, warning cue to steepen, low heating/light g, range overshoot risk. |
| Skip-out | Periapsis `85000 m`, angle `-5.0 deg`. | `skip-out`, critical cue to lower periapsis, terminal skip unless corrected before interface. |
| Steep | Periapsis `18000 m`, angle `-7.5 deg`. | `steep`, warning cue to raise periapsis, high heat/g risk. |
| Overload | Periapsis `8000 m`, angle `-8.4 deg`. | `overload`, critical load/thermal risk, terminal if not corrected. |
| Remote recovery | Valid corridor but splashdown error `> 750 km`. | Survivable entry may occur, but recovery band is `remote` and scenario likely fails. |

Automated coverage should assert that final correction burns update the entry brief, all helper-backed bands remain stable, and failure predicates consume the same classifications shown to the player.
