#!/usr/bin/env node
'use strict';

/**
 * Lightweight ApolloMission math validation.
 *
 * This intentionally does not instantiate ApolloMission: the constructor builds
 * browser UI, planets, scene hooks, and THREE objects. Instead, the checker loads
 * js/mission.js in a Node VM with a tiny window object and a minimal Vector3
 * implementation, then exercises pure prototype helpers plus standalone
 * reference calculations for the currently hard-coded Apollo TLI profile.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const missionPath = path.join(__dirname, 'mission.js');
const missionSource = fs.readFileSync(missionPath, 'utf8');
const orbitGuardsPath = path.join(__dirname, 'apolloOrbitGuards.js');
const orbitGuardsSource = fs.readFileSync(orbitGuardsPath, 'utf8');

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;
        return this;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;
        return this;
    }

    addScaledVector(vector, scale) {
        this.x += vector.x * scale;
        this.y += vector.y * scale;
        this.z += vector.z * scale;
        return this;
    }

    sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        this.z -= vector.z;
        return this;
    }

    multiplyScalar(scale) {
        this.x *= scale;
        this.y *= scale;
        this.z *= scale;
        return this;
    }

    divideScalar(scale) {
        this.x /= scale;
        this.y /= scale;
        this.z /= scale;
        return this;
    }

    negate() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }

    dot(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }

    cross(vector) {
        return this.crossVectors(this, vector);
    }

    crossVectors(a, b) {
        const x = a.y * b.z - a.z * b.y;
        const y = a.z * b.x - a.x * b.z;
        const z = a.x * b.y - a.y * b.x;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length() {
        return Math.sqrt(this.lengthSq());
    }

    normalize() {
        const length = this.length();
        if (length > 0) this.divideScalar(length);
        return this;
    }

    distanceTo(vector) {
        return Math.sqrt(
            (this.x - vector.x) * (this.x - vector.x) +
            (this.y - vector.y) * (this.y - vector.y) +
            (this.z - vector.z) * (this.z - vector.z)
        );
    }
}

function loadApolloMission() {
    const context = {
        console,
        window: {},
        THREE: {
            Vector3,
            MathUtils: {
                clamp(value, min, max) {
                    return Math.min(max, Math.max(min, value));
                },
                degToRad(degrees) {
                    return degrees * Math.PI / 180;
                }
            }
        },
        physics: {
            G: 6.67430e-11,
            trueToMeanAnomaly(trueAnomaly, eccentricity) {
                const cosTA = Math.cos(trueAnomaly);
                const sinTA = Math.sin(trueAnomaly);
                const cosE = (eccentricity + cosTA) / (1 + eccentricity * cosTA);
                const sinE = Math.sqrt(1 - eccentricity * eccentricity) * sinTA / (1 + eccentricity * cosTA);
                const E = Math.atan2(sinE, cosE);
                return E - eccentricity * Math.sin(E);
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(missionSource, context, { filename: missionPath });
    assert.equal(typeof context.window.ApolloMission, 'function', 'ApolloMission should attach to window');
    return context.window.ApolloMission;
}

function loadApolloOrbitGuards() {
    const context = {
        window: {
            APOLLO_CONSTANTS: {
                earth: { radiusM: 6371000 },
                moon: { radiusM: 1737400 }
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(orbitGuardsSource, context, { filename: orbitGuardsPath });
    assert.equal(typeof context.window.ApolloOrbitGuards, 'object', 'ApolloOrbitGuards should attach to window');
    return context.window.ApolloOrbitGuards;
}

function assertClose(actual, expected, tolerance, label) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    );
}

function assertVectorClose(vector, expected, tolerance, label) {
    assertClose(vector.x, expected[0], tolerance, `${label}.x`);
    assertClose(vector.y, expected[1], tolerance, `${label}.y`);
    assertClose(vector.z, expected[2], tolerance, `${label}.z`);
}

function circularSpeed(mu, radius) {
    return Math.sqrt(mu / radius);
}

function hohmannTransfer(mu, initialRadius, targetRadius) {
    const semiMajorAxis = (initialRadius + targetRadius) / 2;
    const initialCircularSpeed = circularSpeed(mu, initialRadius);
    const targetCircularSpeed = circularSpeed(mu, targetRadius);
    const departureTransferSpeed = Math.sqrt(mu * ((2 / initialRadius) - (1 / semiMajorAxis)));
    const arrivalTransferSpeed = Math.sqrt(mu * ((2 / targetRadius) - (1 / semiMajorAxis)));

    return {
        semiMajorAxis,
        initialCircularSpeed,
        targetCircularSpeed,
        departureTransferSpeed,
        arrivalTransferSpeed,
        departureDeltaV: Math.abs(departureTransferSpeed - initialCircularSpeed),
        arrivalDeltaV: Math.abs(targetCircularSpeed - arrivalTransferSpeed),
        timeOfFlight: Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu)
    };
}

const ApolloMission = loadApolloMission();
const ApolloOrbitGuards = loadApolloOrbitGuards();
const checks = [];

function check(name, fn) {
    checks.push({ name, fn });
}

check('MET formatter clamps negatives and rolls seconds into HHH:MM:SS', () => {
    const formatMET = ApolloMission.prototype.formatMET;
    assert.equal(formatMET.call({}, -12), '000:00:00');
    assert.equal(formatMET.call({}, 0), '000:00:00');
    assert.equal(formatMET.call({}, 59.9), '000:00:59');
    assert.equal(formatMET.call({}, 60), '000:01:00');
    assert.equal(formatMET.call({}, 3599), '000:59:59');
    assert.equal(formatMET.call({}, 3600), '001:00:00');
    assert.equal(formatMET.call({}, 72 * 3600 + 5), '072:00:05');
});

check('distance formatter handles km, Mm, and unavailable ranges', () => {
    const formatDistance = ApolloMission.prototype.formatDistance;
    assert.equal(formatDistance.call({}, Infinity), '--');
    assert.equal(formatDistance.call({}, NaN), '--');
    assert.equal(formatDistance.call({}, 0), '0 km');
    assert.equal(formatDistance.call({}, 999999), '1000 km');
    assert.equal(formatDistance.call({}, 1000000), '1.0 Mm');
    assert.equal(formatDistance.call({}, 384400000), '384.4 Mm');
});

check('body-frame guidance vectors are orthonormal for a circular reference state', () => {
    const body = {
        mesh: { position: new Vector3(0, 0, 0) },
        velocity: new Vector3(0, 0, 0)
    };
    const mission = {
        spacecraft: {
            position: new Vector3(7000000, 0, 0),
            velocity: new Vector3(0, 7700, 0)
        }
    };
    const vectors = ApolloMission.prototype.getBodyFrameVectors.call(mission, body);

    assertVectorClose(vectors.radialOut, [1, 0, 0], 1e-12, 'radialOut');
    assertVectorClose(vectors.prograde, [0, 1, 0], 1e-12, 'prograde');
    assertVectorClose(vectors.retrograde, [0, -1, 0], 1e-12, 'retrograde');
    assertVectorClose(vectors.normal, [0, 0, 1], 1e-12, 'normal');
    assertClose(vectors.radialOut.dot(vectors.prograde), 0, 1e-12, 'radial/prograde dot');
    assertClose(vectors.normal.dot(vectors.prograde), 0, 1e-12, 'normal/prograde dot');
});

check('east-vector helper returns a unit vector perpendicular to equator and pole radials', () => {
    const getEastVector = ApolloMission.prototype.getEastVector;
    const equatorEast = getEastVector.call({}, new Vector3(1, 0, 0));
    const poleEast = getEastVector.call({}, new Vector3(0, 1, 0));

    assertVectorClose(equatorEast, [0, 0, -1], 1e-12, 'equatorEast');
    assertClose(poleEast.length(), 1, 1e-12, 'poleEast length');
    assertClose(poleEast.dot(new Vector3(0, 1, 0)), 0, 1e-12, 'poleEast perpendicular');
});

check('moon position update preserves circular radius and expected orbital speed', () => {
    const mission = {
        moonOrbitRadius: 384400000,
        moonPeriod: 27.321661 * 86400,
        moonAngle: Math.PI / 3,
        moon: {
            mesh: { position: new Vector3() },
            velocity: new Vector3()
        },
        scaleManager: {
            vectorToVisualizationSpace(vector) {
                return vector.clone();
            }
        }
    };

    ApolloMission.prototype.updateMoonPosition.call(mission, 0);

    const meanMotion = (Math.PI * 2) / mission.moonPeriod;
    assertClose(mission.moon.mesh.position.length(), mission.moonOrbitRadius, 1e-6, 'moon radius');
    assertClose(mission.moon.velocity.length(), mission.moonOrbitRadius * meanMotion, 1e-9, 'moon speed');

    ApolloMission.prototype.updateMoonPosition.call(mission, mission.moonPeriod / 4);
    assertClose(mission.moon.mesh.position.length(), mission.moonOrbitRadius, 1e-6, 'moon radius after quarter orbit');
});

check('adaptive TLI estimate stays close to an ideal 185 km parking-orbit Hohmann departure', () => {
    const gravitationalConstant = 6.67430e-11;
    const earthMass = 5.972e24;
    const earthRadius = 6371000;
    const parkingAltitude = 185000;
    const moonOrbitRadius = 384400000;
    const muEarth = gravitationalConstant * earthMass;
    const parkingRadius = earthRadius + parkingAltitude;
    const transfer = hohmannTransfer(muEarth, parkingRadius, moonOrbitRadius);
    const mission = Object.assign(Object.create(ApolloMission.prototype), {
        primaryBody: null,
        earth: {
            mass: earthMass,
            mesh: { position: new Vector3(0, 0, 0) }
        },
        moon: {
            mesh: { position: new Vector3(moonOrbitRadius, 0, 0) }
        },
        moonOrbitRadius,
        spacecraft: {
            position: new Vector3(parkingRadius, 0, 0),
            velocity: new Vector3(0, transfer.initialCircularSpeed, 0)
        },
        scaleManager: {
            vectorToRealWorld(vector) {
                return vector.clone();
            },
            toRealWorld(value) {
                return value;
            }
        }
    });
    mission.primaryBody = mission.earth;

    const estimate = ApolloMission.prototype.computeTliDeltaV.call(mission);

    assertClose(transfer.semiMajorAxis, (parkingRadius + moonOrbitRadius) / 2, 1e-6, 'transfer semi-major axis');
    assertClose(circularSpeed(muEarth, parkingRadius), transfer.initialCircularSpeed, 1e-12, 'parking circular speed');
    assert.ok(transfer.initialCircularSpeed > 7700 && transfer.initialCircularSpeed < 7900, 'parking speed should be LEO-like');
    assert.ok(transfer.departureDeltaV > 3100 && transfer.departureDeltaV < 3170, 'ideal TLI delta-v should be near 3.1 km/s');
    assert.ok(transfer.arrivalDeltaV > 800 && transfer.arrivalDeltaV < 870, 'ideal lunar-distance circularization delta-v should be near 0.85 km/s');
    assert.ok(transfer.timeOfFlight / 86400 > 4.8 && transfer.timeOfFlight / 86400 < 5.1, 'Hohmann coast should be about five days');
    assert.ok(estimate, 'mission should produce a TLI estimate');
    assert.equal(estimate.mode, 'prograde');
    assert.ok(Math.abs(estimate.deltaV - transfer.departureDeltaV) < 1, 'mission TLI estimate should track ideal Hohmann departure');
});

check('circular orbit checkpoint state preserves body-relative radius and velocity', () => {
    const gravitationalConstant = 6.67430e-11;
    const earthMass = 5.972e24;
    const earthRadius = 6371000;
    const altitude = 185000;
    const orbitRadius = earthRadius + altitude;
    const body = {
        radius: earthRadius,
        mass: earthMass,
        mesh: { position: new Vector3(10, 20, 30) },
        velocity: new Vector3(1, 2, 3)
    };
    const mission = Object.assign(Object.create(ApolloMission.prototype), {
        scaleManager: {
            toRealWorld(value) {
                return value;
            },
            vectorToVisualizationSpace(vector) {
                return vector.clone();
            }
        }
    });

    const state = ApolloMission.prototype.createCircularOrbitState.call(
        mission,
        body,
        altitude,
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0)
    );

    assertClose(state.orbitRadius, orbitRadius, 1e-9, 'checkpoint radius');
    assertClose(state.relativePosition.length(), orbitRadius, 1e-9, 'relative position radius');
    assertClose(state.relativeVelocity.length(), circularSpeed(gravitationalConstant * earthMass, orbitRadius), 1e-9, 'relative velocity speed');
    assertVectorClose(state.position, [orbitRadius + 10, 20, 30], 1e-9, 'absolute position includes body position');
    assertVectorClose(state.velocity, [1, state.relativeVelocity.y + 2, 3], 1e-9, 'absolute velocity includes body velocity');
});

check('orbit guard formatter gives short flight-director labels', () => {
    const formatOrbitGuard = ApolloMission.prototype.formatOrbitGuard;
    assert.equal(formatOrbitGuard.call({}, null), '--');
    assert.equal(formatOrbitGuard.call({}, { ok: true, issues: [] }), 'GO');
    assert.equal(formatOrbitGuard.call({}, { ok: false, issues: ['periapsis-too-low'] }), 'PE LOW');
    assert.equal(formatOrbitGuard.call({}, { ok: false, issues: ['not-bound'] }), 'ESCAPE');
});

check('Apollo orbit guards accept nominal Earth parking and lunar operations orbits', () => {
    const earthRadius = 6371000;
    const moonRadius = 1737400;
    const earthParking = ApolloOrbitGuards.validateProfile('earthParking', {
        periapsis: earthRadius + 185000,
        apoapsis: earthRadius + 190000,
        eccentricity: 0.0004,
        orbitalPeriod: 5300
    });
    const lunarOrbit = ApolloOrbitGuards.validateProfile('lunarOrbit', {
        periapsis: moonRadius + 105000,
        apoapsis: moonRadius + 115000,
        eccentricity: 0.0027,
        orbitalPeriod: 7200
    });
    const lmAscent = ApolloOrbitGuards.validateProfile('lmAscentInsertion', {
        periapsis: moonRadius + 18000,
        apoapsis: moonRadius + 95000,
        eccentricity: 0.021,
        orbitalPeriod: 6900
    });

    assert.equal(earthParking.ok, true, 'nominal Earth parking orbit should pass');
    assert.equal(lunarOrbit.ok, true, 'nominal lunar orbit should pass');
    assert.equal(lmAscent.ok, true, 'LM ascent insertion orbit should pass');
});

check('Apollo orbit guards reject unsafe or non-bound Apollo progression states', () => {
    const moonRadius = 1737400;
    const lowPerilune = ApolloOrbitGuards.validateProfile('lunarOrbit', {
        periapsis: moonRadius + 12000,
        apoapsis: moonRadius + 110000,
        eccentricity: 0.025,
        orbitalPeriod: 7000
    });
    const escape = ApolloOrbitGuards.validateProfile('lunarOrbit', {
        periapsis: moonRadius + 90000,
        apoapsis: Infinity,
        eccentricity: 1.05,
        orbitalPeriod: Infinity
    });

    assert.equal(lowPerilune.ok, false, 'low perilune should fail lunar orbit guard');
    assert.ok(lowPerilune.issues.includes('periapsis-too-low'), 'low perilune should name periapsis issue');
    assert.equal(escape.ok, false, 'escaping trajectory should fail lunar orbit guard');
    assert.ok(escape.issues.includes('not-bound'), 'escape state should name bound-orbit issue');
});

let failures = 0;

for (const { name, fn } of checks) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`not ok - ${name}`);
        console.error(`  ${error.message}`);
    }
}

if (failures > 0) {
    console.error(`mission-sim-check: ${failures} of ${checks.length} checks failed`);
    process.exit(1);
}

console.log(`mission-sim-check: ${checks.length} checks passed`);
