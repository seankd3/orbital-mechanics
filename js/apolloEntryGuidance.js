"use strict";

(function (root) {
    var VERSION = 1;

    var METERS_PER_KILOMETER = 1000;
    var EARTH_RADIUS_KM = 6371;
    var ENTRY_INTERFACE_ALTITUDE_M = 121920;

    var DEFAULT_ENTRY_TARGET = {
        periapsisAltitudeM: 38000,
        flightPathAngleDeg: -6.45,
        periapsisToleranceM: 12000,
        flightPathAngleToleranceDeg: 0.45
    };

    var DEFAULT_SPLASHDOWN_TARGET = {
        bullseyeKm: 15,
        recoveryZoneKm: 80,
        acceptableKm: 250,
        contingencyKm: 750,
        remoteKm: 1500
    };

    var CORRIDOR_BANDS = [
        {
            id: "skip-out",
            label: "Skip-Out Risk",
            severity: "critical",
            summary: "Too shallow to guarantee atmospheric capture.",
            periapsisMinM: 80000,
            flightPathAngleMinDeg: -5.2,
            cue: "Lower predicted periapsis before entry interface."
        },
        {
            id: "shallow",
            label: "Shallow Corridor",
            severity: "warning",
            summary: "Likely capture, but range overshoot and skip risk are elevated.",
            periapsisMinM: 60000,
            flightPathAngleMinDeg: -5.6,
            cue: "Bias the next correction toward a slightly steeper entry."
        },
        {
            id: "target",
            label: "Target Corridor",
            severity: "nominal",
            summary: "Centered on the Apollo-style Earth entry corridor.",
            periapsisRangeM: [32000, 48000],
            flightPathAngleRangeDeg: [-6.8, -6.0],
            cue: "Hold the entry solution and use bank angle for range control."
        },
        {
            id: "flyable",
            label: "Flyable Corridor",
            severity: "caution",
            summary: "Inside broad capture limits, but not centered on the target corridor.",
            periapsisRangeM: [25000, 60000],
            flightPathAngleRangeDeg: [-7.2, -5.6],
            cue: "Trim toward the target corridor if fuel and timeline allow."
        },
        {
            id: "steep",
            label: "Steep Corridor",
            severity: "warning",
            summary: "Heating, deceleration, and undershoot risk are elevated.",
            periapsisMaxM: 25000,
            flightPathAngleMaxDeg: -7.2,
            cue: "Raise predicted periapsis before entry interface."
        },
        {
            id: "overload",
            label: "Overload Risk",
            severity: "critical",
            summary: "Entry is steep enough to threaten crew loads and thermal margins.",
            periapsisMaxM: 12000,
            flightPathAngleMaxDeg: -8.0,
            cue: "Prioritize an immediate correction that shallows the entry."
        }
    ];

    var HEATING_BINS = [
        {
            id: "low",
            label: "Low",
            severity: "info",
            minIndex: 0,
            maxIndex: 0.3,
            summary: "Thermal load is light, usually paired with a shallow trajectory."
        },
        {
            id: "nominal",
            label: "Nominal",
            severity: "nominal",
            minIndex: 0.3,
            maxIndex: 0.58,
            summary: "Heating is within expected command-module margins."
        },
        {
            id: "elevated",
            label: "Elevated",
            severity: "caution",
            minIndex: 0.58,
            maxIndex: 0.76,
            summary: "Heating is above target and should be monitored."
        },
        {
            id: "high",
            label: "High",
            severity: "warning",
            minIndex: 0.76,
            maxIndex: 0.9,
            summary: "Thermal margin is tight; avoid further steepening."
        },
        {
            id: "extreme",
            label: "Extreme",
            severity: "critical",
            minIndex: 0.9,
            maxIndex: Infinity,
            summary: "Thermal load is outside the desired entry envelope."
        }
    ];

    var G_LOAD_BINS = [
        {
            id: "light",
            label: "Light",
            severity: "info",
            minG: 0,
            maxG: 3,
            summary: "Low deceleration, often associated with shallow range overshoot."
        },
        {
            id: "nominal",
            label: "Nominal",
            severity: "nominal",
            minG: 3,
            maxG: 7,
            summary: "Comfortable Apollo-style command-module deceleration."
        },
        {
            id: "firm",
            label: "Firm",
            severity: "caution",
            minG: 7,
            maxG: 9,
            summary: "Crew loads are noticeable but still manageable."
        },
        {
            id: "high",
            label: "High",
            severity: "warning",
            minG: 9,
            maxG: 12,
            summary: "Crew loads are high enough to reduce operational margin."
        },
        {
            id: "critical",
            label: "Critical",
            severity: "critical",
            minG: 12,
            maxG: Infinity,
            summary: "Crew loads are beyond the preferred survival envelope."
        }
    ];

    var SPLASHDOWN_BANDS = [
        {
            id: "bullseye",
            label: "Bullseye",
            severity: "nominal",
            maxDistanceKm: 15,
            summary: "Inside the primary recovery aim point."
        },
        {
            id: "recovery-zone",
            label: "Recovery Zone",
            severity: "nominal",
            maxDistanceKm: 80,
            summary: "Close enough for quick recovery operations."
        },
        {
            id: "acceptable",
            label: "Acceptable",
            severity: "caution",
            maxDistanceKm: 250,
            summary: "Recoverable, but outside the tight target box."
        },
        {
            id: "contingency",
            label: "Contingency",
            severity: "warning",
            maxDistanceKm: 750,
            summary: "Recovery is possible with a wider search plan."
        },
        {
            id: "remote",
            label: "Remote",
            severity: "critical",
            maxDistanceKm: Infinity,
            summary: "Far outside the intended splashdown area."
        }
    ];

    function freeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) {
            return value;
        }

        Object.keys(value).forEach(function (key) {
            freeze(value[key]);
        });

        return Object.freeze(value);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function finiteNumber(value, fallback) {
        var numberValue = Number(value);

        if (Number.isFinite(numberValue)) {
            return numberValue;
        }

        return fallback;
    }

    function round(value, places) {
        var factor = Math.pow(10, places || 0);

        return Math.round(value * factor) / factor;
    }

    function coerceEntryInput(periapsisAltitudeM, flightPathAngleDeg, options) {
        var input = periapsisAltitudeM;

        if (input && typeof input === "object") {
            options = flightPathAngleDeg || input.options || {};
            flightPathAngleDeg = input.flightPathAngleDeg;
            periapsisAltitudeM = input.periapsisAltitudeM;

            if (periapsisAltitudeM === undefined && input.periapsisAltitudeKm !== undefined) {
                periapsisAltitudeM = Number(input.periapsisAltitudeKm) * METERS_PER_KILOMETER;
            }
        }

        return {
            periapsisAltitudeM: finiteNumber(periapsisAltitudeM, NaN),
            flightPathAngleDeg: finiteNumber(flightPathAngleDeg, NaN),
            options: options || {}
        };
    }

    function coerceEntryTarget(options) {
        var source = options && options.target ? options.target : options || {};

        return {
            periapsisAltitudeM: finiteNumber(source.periapsisAltitudeM, DEFAULT_ENTRY_TARGET.periapsisAltitudeM),
            flightPathAngleDeg: finiteNumber(source.flightPathAngleDeg, DEFAULT_ENTRY_TARGET.flightPathAngleDeg),
            periapsisToleranceM: finiteNumber(source.periapsisToleranceM, DEFAULT_ENTRY_TARGET.periapsisToleranceM),
            flightPathAngleToleranceDeg: finiteNumber(
                source.flightPathAngleToleranceDeg,
                DEFAULT_ENTRY_TARGET.flightPathAngleToleranceDeg
            )
        };
    }

    function cloneBand(band) {
        var copy = {};

        Object.keys(band).forEach(function (key) {
            if (Array.isArray(band[key])) {
                copy[key] = band[key].slice();
            } else {
                copy[key] = band[key];
            }
        });

        return copy;
    }

    function getPeriapsisBand(periapsisAltitudeM) {
        if (!Number.isFinite(periapsisAltitudeM)) {
            return {
                id: "unknown",
                label: "Unknown",
                severity: "info"
            };
        }

        if (periapsisAltitudeM >= 80000) {
            return {
                id: "skip-out",
                label: "Skip-Out Risk",
                severity: "critical"
            };
        }

        if (periapsisAltitudeM > 60000) {
            return {
                id: "shallow",
                label: "Shallow",
                severity: "warning"
            };
        }

        if (periapsisAltitudeM >= 32000 && periapsisAltitudeM <= 48000) {
            return {
                id: "target",
                label: "Target",
                severity: "nominal"
            };
        }

        if (periapsisAltitudeM >= 25000 && periapsisAltitudeM <= 60000) {
            return {
                id: "flyable",
                label: "Flyable",
                severity: "caution"
            };
        }

        if (periapsisAltitudeM >= 12000) {
            return {
                id: "steep",
                label: "Steep",
                severity: "warning"
            };
        }

        return {
            id: "overload",
            label: "Overload Risk",
            severity: "critical"
        };
    }

    function getAngleBand(flightPathAngleDeg) {
        if (!Number.isFinite(flightPathAngleDeg)) {
            return {
                id: "unknown",
                label: "Unknown",
                severity: "info"
            };
        }

        if (flightPathAngleDeg > -5.2) {
            return {
                id: "skip-out",
                label: "Skip-Out Risk",
                severity: "critical"
            };
        }

        if (flightPathAngleDeg > -5.6) {
            return {
                id: "shallow",
                label: "Shallow",
                severity: "warning"
            };
        }

        if (flightPathAngleDeg >= -6.8 && flightPathAngleDeg <= -6.0) {
            return {
                id: "target",
                label: "Target",
                severity: "nominal"
            };
        }

        if (flightPathAngleDeg >= -7.2 && flightPathAngleDeg <= -5.6) {
            return {
                id: "flyable",
                label: "Flyable",
                severity: "caution"
            };
        }

        if (flightPathAngleDeg >= -8.0) {
            return {
                id: "steep",
                label: "Steep",
                severity: "warning"
            };
        }

        return {
            id: "overload",
            label: "Overload Risk",
            severity: "critical"
        };
    }

    function findCorridorBand(periapsisBandId, angleBandId) {
        var bandId = "flyable";

        if (periapsisBandId === "overload" || angleBandId === "overload") {
            bandId = "overload";
        } else if (periapsisBandId === "skip-out" || angleBandId === "skip-out") {
            bandId = "skip-out";
        } else if (periapsisBandId === "steep" || angleBandId === "steep") {
            bandId = "steep";
        } else if (periapsisBandId === "shallow" || angleBandId === "shallow") {
            bandId = "shallow";
        } else if (periapsisBandId === "target" && angleBandId === "target") {
            bandId = "target";
        }

        return cloneBand(CORRIDOR_BANDS.filter(function (band) {
            return band.id === bandId;
        })[0]);
    }

    function scoreCenteredCorridor(periapsisAltitudeM, flightPathAngleDeg, target) {
        var periapsisError = Math.abs(periapsisAltitudeM - target.periapsisAltitudeM) / target.periapsisToleranceM;
        var angleError = Math.abs(flightPathAngleDeg - target.flightPathAngleDeg) / target.flightPathAngleToleranceDeg;
        var combinedError = Math.sqrt((periapsisError * periapsisError + angleError * angleError) / 2);

        return clamp(Math.round(100 - combinedError * 28), 0, 100);
    }

    function buildCorridorReasons(periapsisBand, angleBand, target, periapsisAltitudeM, flightPathAngleDeg) {
        var reasons = [];
        var periapsisDeltaM = periapsisAltitudeM - target.periapsisAltitudeM;
        var angleDeltaDeg = flightPathAngleDeg - target.flightPathAngleDeg;

        if (periapsisBand.id === "skip-out" || periapsisBand.id === "shallow") {
            reasons.push("Predicted periapsis is high for the target corridor.");
        } else if (periapsisBand.id === "steep" || periapsisBand.id === "overload") {
            reasons.push("Predicted periapsis is low for the target corridor.");
        }

        if (angleBand.id === "skip-out" || angleBand.id === "shallow") {
            reasons.push("Flight path angle is shallow at entry interface.");
        } else if (angleBand.id === "steep" || angleBand.id === "overload") {
            reasons.push("Flight path angle is steep at entry interface.");
        }

        if (!reasons.length) {
            reasons.push("Periapsis altitude and flight path angle are inside broad Earth-entry limits.");
        }

        reasons.push("Periapsis delta: " + round(periapsisDeltaM / METERS_PER_KILOMETER, 1) + " km.");
        reasons.push("Flight path angle delta: " + round(angleDeltaDeg, 2) + " deg.");

        return reasons;
    }

    function classifyEntryCorridor(periapsisAltitudeM, flightPathAngleDeg, options) {
        var input = coerceEntryInput(periapsisAltitudeM, flightPathAngleDeg, options);
        var target = coerceEntryTarget(input.options);
        var periapsisBand = getPeriapsisBand(input.periapsisAltitudeM);
        var angleBand = getAngleBand(input.flightPathAngleDeg);
        var band = findCorridorBand(periapsisBand.id, angleBand.id);
        var score = 0;

        if (Number.isFinite(input.periapsisAltitudeM) && Number.isFinite(input.flightPathAngleDeg)) {
            score = scoreCenteredCorridor(input.periapsisAltitudeM, input.flightPathAngleDeg, target);

            if (band.id === "skip-out" || band.id === "overload") {
                score = Math.min(score, 25);
            } else if (band.id === "shallow" || band.id === "steep") {
                score = Math.min(score, 55);
            } else if (band.id === "flyable") {
                score = Math.min(score, 78);
            }
        }

        return {
            id: band.id,
            label: band.label,
            severity: band.severity,
            summary: band.summary,
            cue: band.cue,
            score: score,
            periapsisAltitudeM: input.periapsisAltitudeM,
            flightPathAngleDeg: input.flightPathAngleDeg,
            periapsisBand: periapsisBand,
            angleBand: angleBand,
            target: target,
            deltas: {
                periapsisM: input.periapsisAltitudeM - target.periapsisAltitudeM,
                flightPathAngleDeg: input.flightPathAngleDeg - target.flightPathAngleDeg
            },
            reasons: buildCorridorReasons(
                periapsisBand,
                angleBand,
                target,
                input.periapsisAltitudeM,
                input.flightPathAngleDeg
            )
        };
    }

    function findBin(bins, value, minKey, maxKey) {
        var index;

        for (index = 0; index < bins.length; index += 1) {
            if (value >= bins[index][minKey] && value < bins[index][maxKey]) {
                return cloneBand(bins[index]);
            }
        }

        return cloneBand(bins[bins.length - 1]);
    }

    function classifyHeating(heatingIndex) {
        return findBin(HEATING_BINS, finiteNumber(heatingIndex, 0), "minIndex", "maxIndex");
    }

    function classifyGLoad(peakG) {
        return findBin(G_LOAD_BINS, finiteNumber(peakG, 0), "minG", "maxG");
    }

    function estimateEntryLoads(periapsisAltitudeM, flightPathAngleDeg, options) {
        var input = coerceEntryInput(periapsisAltitudeM, flightPathAngleDeg, options);
        var absAngle = Math.abs(input.flightPathAngleDeg);
        var lowPeriapsisFactor = clamp((65000 - input.periapsisAltitudeM) / 60000, 0, 1.15);
        var steepAngleFactor = clamp((absAngle - 5.2) / 3.0, 0, 1.25);
        var skipCoolingFactor = clamp((input.periapsisAltitudeM - 65000) / 35000, 0, 0.4);
        var heatingIndex = clamp(0.16 + lowPeriapsisFactor * 0.48 + steepAngleFactor * 0.42 - skipCoolingFactor, 0, 1.2);
        var peakG = clamp(1.8 + lowPeriapsisFactor * 5.4 + steepAngleFactor * 5.7, 0, 16);
        var heatRateIndex = clamp(heatingIndex * (0.82 + steepAngleFactor * 0.28), 0, 1.4);

        return {
            periapsisAltitudeM: input.periapsisAltitudeM,
            flightPathAngleDeg: input.flightPathAngleDeg,
            heatingIndex: round(heatingIndex, 3),
            heatRateIndex: round(heatRateIndex, 3),
            peakG: round(peakG, 2),
            heating: classifyHeating(heatingIndex),
            gLoad: classifyGLoad(peakG),
            factors: {
                lowPeriapsis: round(lowPeriapsisFactor, 3),
                steepAngle: round(steepAngleFactor, 3),
                skipCooling: round(skipCoolingFactor, 3)
            }
        };
    }

    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function normalizeLongitudeDeltaDeg(deltaDeg) {
        var wrapped = ((deltaDeg + 540) % 360) - 180;

        return wrapped === -180 ? 180 : wrapped;
    }

    function haversineDistanceKm(aLatDeg, aLonDeg, bLatDeg, bLonDeg) {
        var aLat = degToRad(aLatDeg);
        var bLat = degToRad(bLatDeg);
        var dLat = degToRad(bLatDeg - aLatDeg);
        var dLon = degToRad(normalizeLongitudeDeltaDeg(bLonDeg - aLonDeg));
        var sinLat = Math.sin(dLat / 2);
        var sinLon = Math.sin(dLon / 2);
        var h = sinLat * sinLat + Math.cos(aLat) * Math.cos(bLat) * sinLon * sinLon;

        return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    }

    function coerceSplashdownInput(predicted, target, options) {
        var input = predicted || {};
        var aim = target || input.target || {};

        if (input.predicted) {
            aim = input.target || aim;
            options = target || input.options || options;
            input = input.predicted;
        }

        return {
            predicted: input,
            target: aim,
            options: options || {}
        };
    }

    function getDistanceErrorKm(input, target) {
        if (Number.isFinite(Number(input.distanceErrorKm))) {
            return Math.abs(Number(input.distanceErrorKm));
        }

        if (Number.isFinite(Number(input.rangeErrorKm)) || Number.isFinite(Number(input.crossRangeErrorKm))) {
            return Math.sqrt(
                Math.pow(finiteNumber(input.rangeErrorKm, 0), 2) +
                Math.pow(finiteNumber(input.crossRangeErrorKm, 0), 2)
            );
        }

        if (
            Number.isFinite(Number(input.latDeg)) &&
            Number.isFinite(Number(input.lonDeg)) &&
            Number.isFinite(Number(target.latDeg)) &&
            Number.isFinite(Number(target.lonDeg))
        ) {
            return haversineDistanceKm(
                Number(input.latDeg),
                Number(input.lonDeg),
                Number(target.latDeg),
                Number(target.lonDeg)
            );
        }

        return NaN;
    }

    function coerceSplashdownTarget(options) {
        var source = options && options.thresholds ? options.thresholds : options || {};

        return {
            bullseyeKm: finiteNumber(source.bullseyeKm, DEFAULT_SPLASHDOWN_TARGET.bullseyeKm),
            recoveryZoneKm: finiteNumber(source.recoveryZoneKm, DEFAULT_SPLASHDOWN_TARGET.recoveryZoneKm),
            acceptableKm: finiteNumber(source.acceptableKm, DEFAULT_SPLASHDOWN_TARGET.acceptableKm),
            contingencyKm: finiteNumber(source.contingencyKm, DEFAULT_SPLASHDOWN_TARGET.contingencyKm),
            remoteKm: finiteNumber(source.remoteKm, DEFAULT_SPLASHDOWN_TARGET.remoteKm)
        };
    }

    function classifySplashdown(distanceKm, thresholds) {
        if (!Number.isFinite(distanceKm)) {
            return {
                id: "unknown",
                label: "Unknown",
                severity: "info",
                summary: "Splashdown error cannot be scored without a distance or coordinates."
            };
        }

        if (distanceKm <= thresholds.bullseyeKm) {
            return cloneBand(SPLASHDOWN_BANDS[0]);
        }

        if (distanceKm <= thresholds.recoveryZoneKm) {
            return cloneBand(SPLASHDOWN_BANDS[1]);
        }

        if (distanceKm <= thresholds.acceptableKm) {
            return cloneBand(SPLASHDOWN_BANDS[2]);
        }

        if (distanceKm <= thresholds.contingencyKm) {
            return cloneBand(SPLASHDOWN_BANDS[3]);
        }

        return cloneBand(SPLASHDOWN_BANDS[4]);
    }

    function scoreDistance(distanceKm, thresholds) {
        var normalized;

        if (!Number.isFinite(distanceKm)) {
            return 0;
        }

        if (distanceKm <= thresholds.bullseyeKm) {
            return Math.round(100 - distanceKm / thresholds.bullseyeKm * 5);
        }

        if (distanceKm <= thresholds.recoveryZoneKm) {
            normalized = (distanceKm - thresholds.bullseyeKm) / (thresholds.recoveryZoneKm - thresholds.bullseyeKm);
            return Math.round(95 - normalized * 15);
        }

        if (distanceKm <= thresholds.acceptableKm) {
            normalized = (distanceKm - thresholds.recoveryZoneKm) / (thresholds.acceptableKm - thresholds.recoveryZoneKm);
            return Math.round(80 - normalized * 25);
        }

        if (distanceKm <= thresholds.contingencyKm) {
            normalized = (distanceKm - thresholds.acceptableKm) / (thresholds.contingencyKm - thresholds.acceptableKm);
            return Math.round(55 - normalized * 30);
        }

        normalized = clamp((distanceKm - thresholds.contingencyKm) / (thresholds.remoteKm - thresholds.contingencyKm), 0, 1);

        return Math.round(25 - normalized * 25);
    }

    function estimateRecoveryHours(distanceKm, thresholds) {
        if (!Number.isFinite(distanceKm)) {
            return NaN;
        }

        if (distanceKm <= thresholds.recoveryZoneKm) {
            return round(0.5 + distanceKm / 120, 1);
        }

        return round(1.2 + distanceKm / 180, 1);
    }

    function scoreSplashdown(predicted, target, options) {
        var input = coerceSplashdownInput(predicted, target, options);
        var thresholds = coerceSplashdownTarget(input.options);
        var distanceKm = getDistanceErrorKm(input.predicted, input.target);
        var band = classifySplashdown(distanceKm, thresholds);

        return {
            id: band.id,
            label: band.label,
            severity: band.severity,
            summary: band.summary,
            score: scoreDistance(distanceKm, thresholds),
            distanceErrorKm: Number.isFinite(distanceKm) ? round(distanceKm, 2) : NaN,
            recoveryTimeEstimateHours: estimateRecoveryHours(distanceKm, thresholds),
            thresholds: thresholds
        };
    }

    function addCue(cues, id, priority, title, body, action) {
        cues.push({
            id: id,
            priority: priority,
            title: title,
            body: body,
            action: action
        });
    }

    function compareCuePriority(a, b) {
        var order = {
            critical: 0,
            warning: 1,
            caution: 2,
            nominal: 3,
            info: 4
        };

        return order[a.priority] - order[b.priority];
    }

    function getGuidanceCues(entry, splashdown, options) {
        var cues = [];
        var corridor = classifyEntryCorridor(entry || {}, options || {});
        var loads = estimateEntryLoads(entry || {}, options || {});
        var splash = splashdown ? scoreSplashdown(splashdown, splashdown.target || {}, splashdown.options || {}) : null;

        if (corridor.id === "skip-out") {
            addCue(
                cues,
                "lower-periapsis",
                "critical",
                "Lower periapsis",
                "The predicted entry is too shallow for reliable capture.",
                "Plan a small correction that reduces periapsis altitude and steepens entry angle."
            );
        } else if (corridor.id === "shallow") {
            addCue(
                cues,
                "steepen-entry",
                "warning",
                "Steepen entry",
                "The spacecraft is close to the shallow edge of the corridor.",
                "Bias the next trim burn toward a lower periapsis or slightly more negative flight path angle."
            );
        } else if (corridor.id === "steep") {
            addCue(
                cues,
                "raise-periapsis",
                "warning",
                "Raise periapsis",
                "The trajectory is steep enough to raise heating and g-loads.",
                "Plan a small correction that raises periapsis altitude or shallows the entry angle."
            );
        } else if (corridor.id === "overload") {
            addCue(
                cues,
                "reduce-entry-loads",
                "critical",
                "Reduce entry loads",
                "The predicted entry is outside the preferred crew and thermal envelope.",
                "Prioritize a shallowing correction before entry interface."
            );
        } else if (corridor.id === "target") {
            addCue(
                cues,
                "hold-corridor",
                "nominal",
                "Hold corridor",
                "The entry solution is centered on the target corridor.",
                "Preserve the state vector and reserve bank reversals for range control."
            );
        } else {
            addCue(
                cues,
                "trim-to-center",
                "caution",
                "Trim to center",
                "The entry is flyable but offset from the target corridor.",
                "Use available margin to center periapsis altitude and flight path angle."
            );
        }

        if (loads.heating.severity === "warning" || loads.heating.severity === "critical") {
            addCue(
                cues,
                "protect-thermal-margin",
                loads.heating.severity,
                "Protect thermal margin",
                "Predicted heating is " + loads.heating.label.toLowerCase() + ".",
                "Avoid additional steepening and favor lift-up range control after interface."
            );
        }

        if (loads.gLoad.severity === "warning" || loads.gLoad.severity === "critical") {
            addCue(
                cues,
                "protect-crew-loads",
                loads.gLoad.severity,
                "Protect crew loads",
                "Estimated peak deceleration is " + loads.peakG + " g.",
                "Shallow the entry solution or widen the recovery target before committing."
            );
        }

        if (splash && (splash.severity === "warning" || splash.severity === "critical")) {
            addCue(
                cues,
                "update-recovery",
                splash.severity,
                "Update recovery plan",
                "Predicted splashdown is " + splash.distanceErrorKm + " km from target.",
                "Recompute the landing footprint and widen recovery coverage."
            );
        } else if (splash && splash.severity === "caution") {
            addCue(
                cues,
                "tighten-splashdown",
                "caution",
                "Tighten splashdown",
                "Predicted splashdown is outside the close recovery zone.",
                "Use bank timing or a small pre-entry trim to reduce range error."
            );
        }

        return cues.sort(compareCuePriority);
    }

    function buildEntryBrief(entry, splashdown, options) {
        var corridor = classifyEntryCorridor(entry || {}, options || {});
        var loads = estimateEntryLoads(entry || {}, options || {});
        var splash = splashdown ? scoreSplashdown(splashdown, splashdown.target || {}, splashdown.options || {}) : null;

        return {
            corridor: corridor,
            loads: loads,
            splashdown: splash,
            cues: getGuidanceCues(entry || {}, splashdown, options || {})
        };
    }

    var ApolloEntryGuidance = freeze({
        version: VERSION,
        metadata: {
            description: "Gameplay-oriented Apollo-style Earth entry guidance helpers.",
            units: {
                distance: "m unless a property ends with Km",
                angle: "deg",
                entryInterfaceAltitudeM: ENTRY_INTERFACE_ALTITUDE_M,
                peakDeceleration: "g",
                heatingIndex: "qualitative normalized index"
            },
            assumptions: [
                "Entry numbers are qualitative and intended for mission guidance UI, not flight dynamics.",
                "Flight path angle is negative when descending at entry interface.",
                "Default targets approximate a centered Apollo command-module Earth entry."
            ]
        },
        defaults: {
            entryTarget: DEFAULT_ENTRY_TARGET,
            splashdownTarget: DEFAULT_SPLASHDOWN_TARGET
        },
        corridorBands: CORRIDOR_BANDS,
        heatingBins: HEATING_BINS,
        gLoadBins: G_LOAD_BINS,
        splashdownBands: SPLASHDOWN_BANDS,
        classifyEntryCorridor: classifyEntryCorridor,
        estimateEntryLoads: estimateEntryLoads,
        classifyHeating: classifyHeating,
        classifyGLoad: classifyGLoad,
        scoreSplashdown: scoreSplashdown,
        getGuidanceCues: getGuidanceCues,
        buildEntryBrief: buildEntryBrief
    });

    root.ApolloEntryGuidance = ApolloEntryGuidance;
}(typeof window !== "undefined" ? window : globalThis));
