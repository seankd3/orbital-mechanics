"use strict";

/**
 * Lightweight Apollo-style LM/CSM rendezvous planning helpers.
 *
 * These functions are intentionally pure and gameplay-oriented. They use
 * circular, coplanar orbit assumptions unless a caller supplies more specific
 * state. Distances are meters, time is seconds, and public angle inputs are
 * degrees unless the property name ends in "Rad".
 */
window.ApolloRendezvousPlanner = (function () {
  const DEFAULT_MOON_RADIUS_M = 1737400;
  const DEFAULT_MOON_MU = 4.9048695e12;
  const DEG_PER_RAD = 180 / Math.PI;
  const RAD_PER_DEG = Math.PI / 180;
  const EPSILON = 1e-9;

  function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeSignedDegrees(degrees) {
    let normalized = ((degrees + 180) % 360 + 360) % 360 - 180;

    if (normalized === -180) {
      normalized = 180;
    }

    return normalized;
  }

  function orbitRadiusFromAltitude(altitudeM, bodyRadiusM) {
    return Math.max(EPSILON, bodyRadiusM + altitudeM);
  }

  function meanMotion(mu, orbitRadiusM) {
    return Math.sqrt(mu / Math.pow(orbitRadiusM, 3));
  }

  function circularPeriod(mu, orbitRadiusM) {
    return 2 * Math.PI / meanMotion(mu, orbitRadiusM);
  }

  function hohmannTransferTime(mu, startRadiusM, targetRadiusM) {
    const semiMajorAxisM = (startRadiusM + targetRadiusM) / 2;
    return Math.PI * Math.sqrt(Math.pow(semiMajorAxisM, 3) / mu);
  }

  function phaseLabel(phaseAngleDeg) {
    if (Math.abs(phaseAngleDeg) < 0.25) {
      return "aligned";
    }

    return phaseAngleDeg > 0 ? "target-ahead" : "target-behind";
  }

  /**
   * Estimate the phase angle needed at the start of a transfer.
   *
   * Positive phase means the target/CSM should be ahead of the chaser/LM.
   * A negative value means the target should trail the chaser.
   *
   * @param {Object} options
   * @param {number} options.chaserAltitudeM - Starting circular orbit altitude.
   * @param {number} options.targetAltitudeM - Target circular orbit altitude.
   * @param {number} [options.bodyRadiusM] - Central body radius.
   * @param {number} [options.mu] - Central body gravitational parameter.
   * @param {number} [options.transferTimeS] - Override transfer coast time.
   * @returns {Object} Phase angle and supporting orbit timing.
   */
  function phaseAngleEstimate(options) {
    const config = options || {};
    const mu = finiteNumber(config.mu, DEFAULT_MOON_MU);
    const bodyRadiusM = finiteNumber(config.bodyRadiusM, DEFAULT_MOON_RADIUS_M);
    const chaserAltitudeM = finiteNumber(config.chaserAltitudeM, 45000);
    const targetAltitudeM = finiteNumber(config.targetAltitudeM, 110000);
    const chaserRadiusM = orbitRadiusFromAltitude(chaserAltitudeM, bodyRadiusM);
    const targetRadiusM = orbitRadiusFromAltitude(targetAltitudeM, bodyRadiusM);
    const transferTimeS = finiteNumber(
      config.transferTimeS,
      hohmannTransferTime(mu, chaserRadiusM, targetRadiusM)
    );
    const targetMeanMotionRadS = meanMotion(mu, targetRadiusM);
    const chaserMeanMotionRadS = meanMotion(mu, chaserRadiusM);
    const phaseAngleRad = Math.PI - targetMeanMotionRadS * transferTimeS;
    const phaseAngleDeg = normalizeSignedDegrees(phaseAngleRad * DEG_PER_RAD);

    return {
      phaseAngleDeg: phaseAngleDeg,
      phaseAngleRad: phaseAngleDeg * RAD_PER_DEG,
      label: phaseLabel(phaseAngleDeg),
      transferTimeS: transferTimeS,
      transferTimeMin: transferTimeS / 60,
      chaserOrbitRadiusM: chaserRadiusM,
      targetOrbitRadiusM: targetRadiusM,
      chaserPeriodS: circularPeriod(mu, chaserRadiusM),
      targetPeriodS: circularPeriod(mu, targetRadiusM),
      chaserMeanMotionRadS: chaserMeanMotionRadS,
      targetMeanMotionRadS: targetMeanMotionRadS,
      interpretation:
        "Positive phase means the target should lead the chaser at transfer ignition."
    };
  }

  /**
   * Summarize simple relative motion between LM and CSM circular orbits.
   *
   * @param {Object} options
   * @param {number} options.chaserAltitudeM - LM or active vehicle altitude.
   * @param {number} options.targetAltitudeM - CSM or passive target altitude.
   * @param {number} [options.currentPhaseAngleDeg] - Target ahead of chaser.
   * @param {number} [options.rangeM] - Current line-of-sight range.
   * @param {number} [options.rangeRateMps] - Positive when range is opening.
   * @param {number} [options.bodyRadiusM] - Central body radius.
   * @param {number} [options.mu] - Central body gravitational parameter.
   * @returns {Object} Relative rates, range trend, and catch-up estimate.
   */
  function relativeMotionSummary(options) {
    const config = options || {};
    const mu = finiteNumber(config.mu, DEFAULT_MOON_MU);
    const bodyRadiusM = finiteNumber(config.bodyRadiusM, DEFAULT_MOON_RADIUS_M);
    const chaserAltitudeM = finiteNumber(config.chaserAltitudeM, 45000);
    const targetAltitudeM = finiteNumber(config.targetAltitudeM, 110000);
    const chaserRadiusM = orbitRadiusFromAltitude(chaserAltitudeM, bodyRadiusM);
    const targetRadiusM = orbitRadiusFromAltitude(targetAltitudeM, bodyRadiusM);
    const chaserMeanMotionRadS = meanMotion(mu, chaserRadiusM);
    const targetMeanMotionRadS = meanMotion(mu, targetRadiusM);
    const relativeRateRadS = chaserMeanMotionRadS - targetMeanMotionRadS;
    const relativeRateDegMin = relativeRateRadS * DEG_PER_RAD * 60;
    const currentPhaseAngleDeg = finiteNumber(config.currentPhaseAngleDeg, NaN);
    const phaseToCloseDeg = Number.isFinite(currentPhaseAngleDeg)
      ? normalizeSignedDegrees(currentPhaseAngleDeg)
      : null;
    const sameDirectionCatchup =
      phaseToCloseDeg !== null &&
      Math.abs(relativeRateDegMin) > EPSILON &&
      Math.sign(phaseToCloseDeg) === Math.sign(relativeRateDegMin);
    const timeToPhaseCloseS = sameDirectionCatchup
      ? Math.abs(phaseToCloseDeg / relativeRateDegMin) * 60
      : null;
    const rangeRateMps = finiteNumber(config.rangeRateMps, NaN);
    let rangeTrend = "unknown";

    if (Number.isFinite(rangeRateMps)) {
      if (Math.abs(rangeRateMps) < 0.05) {
        rangeTrend = "steady";
      } else {
        rangeTrend = rangeRateMps < 0 ? "closing" : "opening";
      }
    }

    let drift = "coelliptic";

    if (Math.abs(relativeRateDegMin) >= 0.01) {
      drift = relativeRateDegMin > 0 ? "chaser-gaining" : "target-gaining";
    }

    return {
      drift: drift,
      rangeTrend: rangeTrend,
      rangeM: finiteNumber(config.rangeM, null),
      rangeRateMps: Number.isFinite(rangeRateMps) ? rangeRateMps : null,
      currentPhaseAngleDeg: phaseToCloseDeg,
      timeToPhaseCloseS: timeToPhaseCloseS,
      timeToPhaseCloseMin: timeToPhaseCloseS === null ? null : timeToPhaseCloseS / 60,
      altitudeDifferenceM: chaserAltitudeM - targetAltitudeM,
      relativeRateRadS: relativeRateRadS,
      relativeRateDegMin: relativeRateDegMin,
      chaserMeanMotionRadS: chaserMeanMotionRadS,
      targetMeanMotionRadS: targetMeanMotionRadS,
      summary:
        drift === "coelliptic"
          ? "The vehicles have nearly matched angular rates."
          : "The lower, faster orbit will reduce phase angle over time."
    };
  }

  /**
   * Suggest a coelliptic chaser altitude for closing a phase angle over time.
   *
   * Positive phaseAngleDeg assumes the CSM is ahead and the LM should be placed
   * lower than the CSM to catch up. Negative phase suggests a higher chaser
   * orbit so the target can drift forward.
   *
   * @param {Object} options
   * @param {number} options.targetAltitudeM - CSM circular orbit altitude.
   * @param {number} [options.phaseAngleDeg] - Current target lead angle.
   * @param {number} [options.desiredCatchupTimeS] - Desired drift time.
   * @param {number} [options.minAltitudeM] - Clamp for suggested altitude.
   * @param {number} [options.maxAltitudeM] - Clamp for suggested altitude.
   * @param {number} [options.bodyRadiusM] - Central body radius.
   * @param {number} [options.mu] - Central body gravitational parameter.
   * @returns {Object} Suggested altitude and expected drift rate.
   */
  function coellipticAltitudeSuggestion(options) {
    const config = options || {};
    const mu = finiteNumber(config.mu, DEFAULT_MOON_MU);
    const bodyRadiusM = finiteNumber(config.bodyRadiusM, DEFAULT_MOON_RADIUS_M);
    const targetAltitudeM = finiteNumber(config.targetAltitudeM, 110000);
    const targetRadiusM = orbitRadiusFromAltitude(targetAltitudeM, bodyRadiusM);
    const targetMeanMotionRadS = meanMotion(mu, targetRadiusM);
    const phaseAngleDeg = normalizeSignedDegrees(finiteNumber(config.phaseAngleDeg, 20));
    const desiredCatchupTimeS = Math.max(
      60,
      finiteNumber(config.desiredCatchupTimeS, 45 * 60)
    );
    const requiredRelativeRateRadS = (phaseAngleDeg * RAD_PER_DEG) / desiredCatchupTimeS;
    const desiredChaserMeanMotionRadS = Math.max(
      EPSILON,
      targetMeanMotionRadS + requiredRelativeRateRadS
    );
    const rawRadiusM = Math.pow(mu / Math.pow(desiredChaserMeanMotionRadS, 2), 1 / 3);
    const rawAltitudeM = rawRadiusM - bodyRadiusM;
    const minAltitudeM = finiteNumber(config.minAltitudeM, 15000);
    const maxAltitudeM = finiteNumber(config.maxAltitudeM, 160000);
    const suggestedAltitudeM = clamp(rawAltitudeM, minAltitudeM, maxAltitudeM);
    const suggestedRadiusM = orbitRadiusFromAltitude(suggestedAltitudeM, bodyRadiusM);
    const actualRelativeRateRadS = meanMotion(mu, suggestedRadiusM) - targetMeanMotionRadS;
    const actualRelativeRateDegMin = actualRelativeRateRadS * DEG_PER_RAD * 60;
    const expectedCatchupTimeS =
      Math.abs(actualRelativeRateDegMin) > EPSILON
        ? Math.abs(phaseAngleDeg / actualRelativeRateDegMin) * 60
        : null;

    return {
      suggestedAltitudeM: suggestedAltitudeM,
      altitudeOffsetFromTargetM: suggestedAltitudeM - targetAltitudeM,
      unclampedAltitudeM: rawAltitudeM,
      wasClamped: suggestedAltitudeM !== rawAltitudeM,
      phaseAngleDeg: phaseAngleDeg,
      desiredCatchupTimeS: desiredCatchupTimeS,
      expectedCatchupTimeS: expectedCatchupTimeS,
      expectedCatchupTimeMin: expectedCatchupTimeS === null ? null : expectedCatchupTimeS / 60,
      relativeRateDegMin: actualRelativeRateDegMin,
      guidance:
        suggestedAltitudeM < targetAltitudeM
          ? "Use a lower coelliptic orbit so the chaser gains phase."
          : "Use a higher coelliptic orbit so the target drifts ahead."
    };
  }

  /**
   * Score readiness for a terminal phase initiation burn.
   *
   * The heuristic favors modest range, small phase and altitude errors, gentle
   * closing rates, and an optional line-of-sight elevation near the Apollo-style
   * TPI mark.
   *
   * @param {Object} options
   * @param {number} options.rangeM - Current line-of-sight range.
   * @param {number} [options.rangeRateMps] - Positive when range is opening.
   * @param {number} [options.phaseErrorDeg] - Degrees from desired phase.
   * @param {number} [options.altitudeDifferenceM] - Chaser minus target altitude.
   * @param {number} [options.lineOfSightElevationDeg] - Optional sightline angle.
   * @param {number} [options.desiredLineOfSightElevationDeg] - Optional TPI mark.
   * @returns {Object} Readiness gates, score, and recommendation.
   */
  function terminalPhaseInitiationHeuristic(options) {
    const config = options || {};
    const rangeM = finiteNumber(config.rangeM, NaN);
    const rangeRateMps = finiteNumber(config.rangeRateMps, 0);
    const phaseErrorDeg = Math.abs(normalizeSignedDegrees(finiteNumber(config.phaseErrorDeg, 0)));
    const altitudeDifferenceM = finiteNumber(config.altitudeDifferenceM, 0);
    const lineOfSightElevationDeg = finiteNumber(config.lineOfSightElevationDeg, NaN);
    const desiredLineOfSightElevationDeg = finiteNumber(
      config.desiredLineOfSightElevationDeg,
      27
    );
    const closingRateMps = -rangeRateMps;
    const timeToInterceptS =
      Number.isFinite(rangeM) && closingRateMps > EPSILON ? rangeM / closingRateMps : null;
    const rangeOk = Number.isFinite(rangeM) && rangeM >= 15000 && rangeM <= 120000;
    const phaseOk = phaseErrorDeg <= 3;
    const altitudeOk = Math.abs(altitudeDifferenceM) <= 10000;
    const closingOk = closingRateMps >= -0.5 && closingRateMps <= 35;
    const timeOk =
      timeToInterceptS === null || (timeToInterceptS >= 20 * 60 && timeToInterceptS <= 75 * 60);
    const sightlineOk =
      !Number.isFinite(lineOfSightElevationDeg) ||
      Math.abs(lineOfSightElevationDeg - desiredLineOfSightElevationDeg) <= 3;
    const gates = {
      range: rangeOk,
      phase: phaseOk,
      altitude: altitudeOk,
      closingRate: closingOk,
      timeToIntercept: timeOk,
      lineOfSightElevation: sightlineOk
    };
    const passedCount = Object.keys(gates).reduce(function (count, key) {
      return count + (gates[key] ? 1 : 0);
    }, 0);
    const score = passedCount / Object.keys(gates).length;
    const ready = score >= 0.85 && rangeOk && phaseOk && altitudeOk;
    let recommendation = "Hold coelliptic drift and refine the state vector.";

    if (ready) {
      recommendation = "Proceed with terminal phase initiation planning.";
    } else if (!rangeOk) {
      recommendation = "Wait for range to enter the TPI corridor.";
    } else if (!phaseOk) {
      recommendation = "Trim phase before committing to TPI.";
    } else if (!altitudeOk) {
      recommendation = "Reduce altitude separation before TPI.";
    }

    return {
      ready: ready,
      score: score,
      recommendation: recommendation,
      gates: gates,
      rangeM: Number.isFinite(rangeM) ? rangeM : null,
      rangeRateMps: rangeRateMps,
      closingRateMps: closingRateMps,
      phaseErrorDeg: phaseErrorDeg,
      altitudeDifferenceM: altitudeDifferenceM,
      lineOfSightElevationDeg: Number.isFinite(lineOfSightElevationDeg)
        ? lineOfSightElevationDeg
        : null,
      desiredLineOfSightElevationDeg: desiredLineOfSightElevationDeg,
      timeToInterceptS: timeToInterceptS,
      timeToInterceptMin: timeToInterceptS === null ? null : timeToInterceptS / 60
    };
  }

  return {
    version: 1,
    defaults: {
      moonRadiusM: DEFAULT_MOON_RADIUS_M,
      moonMu: DEFAULT_MOON_MU
    },
    phaseAngleEstimate: phaseAngleEstimate,
    relativeMotionSummary: relativeMotionSummary,
    coellipticAltitudeSuggestion: coellipticAltitudeSuggestion,
    terminalPhaseInitiationHeuristic: terminalPhaseInitiationHeuristic,
    estimatePhaseAngle: phaseAngleEstimate,
    summarizeRelativeMotion: relativeMotionSummary,
    suggestCoellipticAltitude: coellipticAltitudeSuggestion,
    assessTerminalPhaseInitiation: terminalPhaseInitiationHeuristic
  };
}());
