import { Vector3 } from 'three';
import { ATMOSPHERE, EARTH } from '../constants';

export interface OrbitalElements {
  /** Gravitational parameter of the primary these elements are relative to. */
  mu: number;
  eccentricity: number;
  semiMajorAxis: number; // m
  periapsis: number; // m from center
  apoapsis: number; // m from center (Infinity if e >= 1)
  period: number; // s (Infinity if e >= 1)
  inclination: number; // rad
  ascendingNode: number; // rad
  argOfPeriapsis: number; // rad
  trueAnomaly: number; // rad
  hVec: Vector3; // specific angular momentum
  /** Unit vector toward periapsis. */
  eHat: Vector3;
  /** Unit vector 90° ahead of periapsis in the direction of motion. */
  qHat: Vector3;
}

const TWO_PI = Math.PI * 2;

export function gravityAccel(pos: Vector3, mu = EARTH.mu): Vector3 {
  const r = pos.length();
  return pos.clone().multiplyScalar(-mu / (r * r * r));
}

/** Exponential-atmosphere drag acceleration; zero above the ceiling. */
export function dragAccel(pos: Vector3, vel: Vector3, mass: number): Vector3 {
  const alt = pos.length() - EARTH.radius;
  if (alt > ATMOSPHERE.ceiling) return new Vector3();
  const rho = ATMOSPHERE.seaLevelDensity * Math.exp(-Math.max(alt, 0) / ATMOSPHERE.scaleHeight);
  const speed = vel.length();
  if (speed < 1e-6) return new Vector3();
  const mag = (0.5 * rho * speed * speed * ATMOSPHERE.cdA) / mass;
  return vel.clone().normalize().multiplyScalar(-mag);
}

/**
 * One RK4 step of two-body motion plus an external acceleration
 * (thrust + drag) evaluated per sub-stage.
 */
export function rk4Step(
  pos: Vector3,
  vel: Vector3,
  dt: number,
  extraAccel: (p: Vector3, v: Vector3) => Vector3,
  mu = EARTH.mu,
): void {
  const a = (p: Vector3, v: Vector3) => gravityAccel(p, mu).add(extraAccel(p, v));

  const k1v = a(pos, vel);
  const k1p = vel.clone();

  const k2p = vel.clone().addScaledVector(k1v, dt / 2);
  const k2v = a(pos.clone().addScaledVector(k1p, dt / 2), k2p);

  const k3p = vel.clone().addScaledVector(k2v, dt / 2);
  const k3v = a(pos.clone().addScaledVector(k2p, dt / 2), k3p);

  const k4p = vel.clone().addScaledVector(k3v, dt);
  const k4v = a(pos.clone().addScaledVector(k3p, dt), k4p);

  pos.addScaledVector(k1p.add(k2p.multiplyScalar(2)).add(k3p.multiplyScalar(2)).add(k4p), dt / 6);
  vel.addScaledVector(k1v.add(k2v.multiplyScalar(2)).add(k3v.multiplyScalar(2)).add(k4v), dt / 6);
}

export function elementsFromState(pos: Vector3, vel: Vector3, mu = EARTH.mu): OrbitalElements {
  const r = pos.length();
  const v = vel.length();

  const energy = (v * v) / 2 - mu / r;
  const hVec = new Vector3().crossVectors(pos, vel);

  const eVec = new Vector3()
    .crossVectors(vel, hVec)
    .divideScalar(mu)
    .sub(pos.clone().normalize());
  const ecc = eVec.length();

  const sma = -mu / (2 * energy);
  const periapsis = sma * (1 - ecc);
  const apoapsis = ecc < 1 ? sma * (1 + ecc) : Infinity;
  const period = ecc < 1 ? TWO_PI * Math.sqrt((sma * sma * sma) / mu) : Infinity;

  const hNorm = hVec.clone().normalize();
  const inclination = Math.acos(clamp(hNorm.y, -1, 1)); // Y-up world

  // Node vector: up × h
  const nodeVec = new Vector3(0, 1, 0).cross(hNorm);
  let ascendingNode = 0;
  if (nodeVec.lengthSq() > 1e-12) {
    ascendingNode = Math.atan2(nodeVec.z, nodeVec.x);
    if (ascendingNode < 0) ascendingNode += TWO_PI;
  }

  let argOfPeriapsis = 0;
  if (ecc > 1e-8) {
    if (nodeVec.lengthSq() > 1e-12) {
      argOfPeriapsis = Math.acos(clamp(nodeVec.clone().normalize().dot(eVec.clone().normalize()), -1, 1));
      if (eVec.y < 0) argOfPeriapsis = TWO_PI - argOfPeriapsis;
    } else {
      argOfPeriapsis = Math.atan2(eVec.z, eVec.x);
      if (argOfPeriapsis < 0) argOfPeriapsis += TWO_PI;
    }
  }

  // Frame-free perifocal basis: exact reconstruction regardless of frame conventions.
  const hUnit = hVec.clone().normalize();
  let eHat: Vector3;
  if (ecc > 1e-8) {
    eHat = eVec.clone().normalize();
  } else {
    // Circular orbit: measure anomaly from the current position.
    eHat = pos.clone().normalize();
  }
  const qHat = new Vector3().crossVectors(hUnit, eHat).normalize();

  let trueAnomaly = Math.atan2(pos.dot(qHat), pos.dot(eHat));
  if (trueAnomaly < 0) trueAnomaly += TWO_PI;

  return { mu, eccentricity: ecc, semiMajorAxis: sma, periapsis, apoapsis, period, inclination, ascendingNode, argOfPeriapsis, trueAnomaly, hVec, eHat, qHat };
}

/** Position (and optionally velocity) in world space at a given true anomaly. */
export function stateAtTrueAnomaly(
  el: OrbitalElements,
  nu: number,
  outVel?: Vector3,
): Vector3 {
  const { eccentricity: e, semiMajorAxis: a, eHat, qHat } = el;
  const p = a * (1 - e * e); // semi-latus rectum
  const r = p / (1 + e * Math.cos(nu));

  const pos = new Vector3()
    .addScaledVector(eHat, r * Math.cos(nu))
    .addScaledVector(qHat, r * Math.sin(nu));

  if (outVel) {
    const h = el.hVec.length();
    outVel
      .set(0, 0, 0)
      .addScaledVector(eHat, (-h / p) * Math.sin(nu))
      .addScaledVector(qHat, (h / p) * (e + Math.cos(nu)));
  }
  return pos;
}

export function trueToMeanAnomaly(nu: number, e: number): number {
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);
  const denom = 1 + e * cosNu;
  const E = Math.atan2(Math.sqrt(1 - e * e) * sinNu / denom, (e + cosNu) / denom);
  let M = E - e * Math.sin(E);
  M %= TWO_PI;
  if (M < 0) M += TWO_PI;
  return M;
}

export function meanToTrueAnomaly(M: number, e: number): number {
  const E = solveKepler(M, e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  let nu = Math.atan2(Math.sqrt(1 - e * e) * sinE / (1 - e * cosE), (cosE - e) / (1 - e * cosE));
  if (nu < 0) nu += TWO_PI;
  return nu;
}

export function solveKepler(M: number, e: number): number {
  M %= TWO_PI;
  if (M < 0) M += TWO_PI;
  let E = e > 0.8 ? Math.PI : M;
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Mean motion, rad/s. */
export function meanMotion(el: OrbitalElements): number {
  return Math.sqrt(el.mu / Math.pow(el.semiMajorAxis, 3));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
