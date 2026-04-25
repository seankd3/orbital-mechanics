"use strict";

/**
 * Pure Apollo orbit validation helpers.
 *
 * These guards keep mission code and tests aligned on the basic "orbit first"
 * gates: Apollo gameplay should establish a stable parking or lunar orbit
 * before advancing to later assists. Inputs use real-world meters.
 */
window.ApolloOrbitGuards = (function () {
  const CONSTANTS = window.APOLLO_CONSTANTS || {};
  const EARTH_RADIUS_M = CONSTANTS.earth ? CONSTANTS.earth.radiusM : 6371000;
  const MOON_RADIUS_M = CONSTANTS.moon ? CONSTANTS.moon.radiusM : 1737400;

  const PROFILES = {
    earthParking: {
      body: "earth",
      minPeriapsisAltitudeM: 160000,
      maxApoapsisAltitudeM: 2000000,
      maxEccentricity: 0.18
    },
    lunarOrbit: {
      body: "moon",
      minPeriapsisAltitudeM: 15000,
      maxApoapsisAltitudeM: 300000,
      maxEccentricity: 0.22
    },
    lmAscentInsertion: {
      body: "moon",
      minPeriapsisAltitudeM: 15000,
      maxApoapsisAltitudeM: 120000,
      maxEccentricity: 0.35
    }
  };

  function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function bodyRadius(body) {
    if (body === "moon") return MOON_RADIUS_M;
    return EARTH_RADIUS_M;
  }

  function normalizeOrbit(orbit, radiusM) {
    const source = orbit || {};
    const periapsisM = finiteNumber(source.periapsisM, source.periapsis);
    const apoapsisM = finiteNumber(source.apoapsisM, source.apoapsis);

    return {
      periapsisM: periapsisM,
      apoapsisM: apoapsisM,
      periapsisAltitudeM: finiteNumber(source.periapsisAltitudeM, periapsisM - radiusM),
      apoapsisAltitudeM: finiteNumber(source.apoapsisAltitudeM, apoapsisM - radiusM),
      eccentricity: finiteNumber(source.eccentricity, NaN),
      orbitalPeriodS: finiteNumber(source.orbitalPeriodS, source.orbitalPeriod)
    };
  }

  function validateOrbit(orbit, options) {
    const config = options || {};
    const radiusM = finiteNumber(config.bodyRadiusM, bodyRadius(config.body));
    const normalized = normalizeOrbit(orbit, radiusM);
    const minPeriapsisAltitudeM = finiteNumber(config.minPeriapsisAltitudeM, 0);
    const maxApoapsisAltitudeM = finiteNumber(config.maxApoapsisAltitudeM, Infinity);
    const maxEccentricity = finiteNumber(config.maxEccentricity, Infinity);
    const issues = [];

    if (!Number.isFinite(normalized.periapsisAltitudeM)) {
      issues.push("periapsis-unavailable");
    } else if (normalized.periapsisAltitudeM < 0) {
      issues.push("surface-intersecting");
    } else if (normalized.periapsisAltitudeM < minPeriapsisAltitudeM) {
      issues.push("periapsis-too-low");
    }

    if (!Number.isFinite(normalized.apoapsisAltitudeM)) {
      issues.push("apoapsis-unavailable");
    } else if (normalized.apoapsisAltitudeM > maxApoapsisAltitudeM) {
      issues.push("apoapsis-too-high");
    }

    if (!Number.isFinite(normalized.eccentricity)) {
      issues.push("eccentricity-unavailable");
    } else if (normalized.eccentricity >= 1) {
      issues.push("not-bound");
    } else if (normalized.eccentricity > maxEccentricity) {
      issues.push("eccentricity-too-high");
    }

    if (!Number.isFinite(normalized.orbitalPeriodS)) {
      issues.push("period-unavailable");
    }

    return {
      ok: issues.length === 0,
      issues: issues,
      orbit: normalized,
      thresholds: {
        bodyRadiusM: radiusM,
        minPeriapsisAltitudeM: minPeriapsisAltitudeM,
        maxApoapsisAltitudeM: maxApoapsisAltitudeM,
        maxEccentricity: maxEccentricity
      }
    };
  }

  function validateProfile(profileName, orbit, overrides) {
    const profile = PROFILES[profileName];
    if (!profile) {
      throw new Error("Unknown Apollo orbit profile: " + profileName);
    }

    return validateOrbit(orbit, Object.assign({}, profile, overrides || {}));
  }

  return {
    version: 1,
    profiles: PROFILES,
    validateOrbit: validateOrbit,
    validateProfile: validateProfile
  };
}());
