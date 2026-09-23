import { Vector3 } from 'three';
import { ATMOSPHERE, EARTH, MOON } from '../constants';
import { EARTH_BODY } from './bodies';
import {
  coastTo,
  predictBurn,
  toManeuver,
  type BurnPrediction,
  type Engine,
  type FlightState,
  type Maneuver,
} from './burn';
import { lunarPass, type Arc } from './coast';
import { lambert } from './lambert';
import { Orbit } from './orbit';

/** Mission targets (radii from the body's center, angles in radians). */
export const TARGET = {
  /** Perilune for the lunar approach; negative = clockwise around the Moon, like Apollo. */
  perilune: -(MOON.radius + 110_000),
  lunarOrbit: MOON.radius + 110_000,
  descentPerilune: MOON.radius + 15_000,
  entryAngle: (-6.5 * Math.PI) / 180,
  entryInterface: EARTH.radius + ATMOSPHERE.interface,
  /** TLI energy: aim the transfer apogee beyond the Moon (~73 h coast). */
  tliApogee: 1.3 * MOON.orbitRadius,
  /** TEI burn size — sets the ~3 day trip home. */
  teiDeltaV: 1_000,
};

const HORIZON = 12 * 86_400;

type Measure = (p: BurnPrediction) => number | null;

// --- measures ----------------------------------------------------------------

/** Signed lunar periapsis radius of a predicted path (null if it never gets close). */
export function perilune(arcs: Arc[]): number | null {
  const pass = lunarPass(arcs);
  return pass && pass.captured ? pass.signedRadius : null;
}

/**
 * Flight-path angle at entry interface on an Earth arc (rad, negative =
 * descending). A path that misses the interface reads as a positive
 * "virtual" angle that grows with the miss, so the function stays monotone.
 */
export function entryAngle(orbit: Orbit): number {
  const rEI = TARGET.entryInterface;
  const vEI = Math.sqrt(Math.max(0, 2 * (orbit.mu / rEI - orbit.mu / (2 * orbit.a))));
  const cosGamma = orbit.h / (rEI * vEI);
  if (cosGamma <= 1) return -Math.acos(Math.max(-1, cosGamma));
  return Math.acos(1 / cosGamma); // miss: positive and increasing with h
}

/** The Earth-bound leg of a return path. */
export function earthArc(arcs: Arc[]): Arc | null {
  const arc = arcs[arcs.length - 1];
  return arc && arc.primary === EARTH_BODY ? arc : null;
}

// --- generic root finding ----------------------------------------------------

/** Secant/bisection hybrid on a bracketed root. */
function refineRoot(f: (x: number) => number | null, a: number, fa: number, b: number, fb: number, tol: number): number | null {
  for (let i = 0; i < 60 && Math.abs(b - a) > tol; i++) {
    let x = b - (fb * (b - a)) / (fb - fa);
    if (!(x > Math.min(a, b) && x < Math.max(a, b))) x = (a + b) / 2;
    const fx = f(x);
    if (fx === null) return null;
    if (Math.sign(fx) === Math.sign(fa)) {
      a = x;
      fa = fx;
    } else {
      b = x;
      fb = fx;
    }
  }
  return Math.abs(fa) < Math.abs(fb) ? a : b;
}

/** First root of f over [t0, t1] sampled every `step` (both ends must be defined). */
function firstRoot(f: (x: number) => number | null, t0: number, t1: number, step: number, tol: number): number | null {
  let prevX = t0;
  let prevF = f(t0);
  for (let x = t0 + step; x <= t1; x += step) {
    const fx = f(x);
    if (prevF !== null && fx !== null && Math.sign(prevF) !== Math.sign(fx)) {
      const root = refineRoot(f, prevX, prevF, x, fx, tol);
      if (root !== null) return root;
    }
    prevX = x;
    prevF = fx;
  }
  return null;
}

/**
 * Minimum-norm Newton on the in-plane Δv (prograde, radial) at a fixed TIG
 * so that `measure` hits `goal`.
 */
function solveInPlane(now: FlightState, engine: Engine, start: Maneuver, measure: Measure, goal: number, tol: number): Maneuver | null {
  let m = { ...start };
  const evalAt = (mm: Maneuver) => {
    const v = measure(predictBurn(now, engine, mm, HORIZON));
    return v === null ? null : v - goal;
  };
  let f = evalAt(m);
  for (let i = 0; i < 25 && f !== null && Math.abs(f) > tol; i++) {
    const h = Math.max(0.02, 0.001 * Math.hypot(m.prograde, m.radial));
    const fp = evalAt({ ...m, prograde: m.prograde + h });
    const fr = evalAt({ ...m, radial: m.radial + h });
    if (fp === null || fr === null) return null;
    const gp = (fp - f) / h;
    const gr = (fr - f) / h;
    const g2 = gp * gp + gr * gr;
    if (g2 === 0) return null;
    // Step, halved until the error shrinks (keeps Newton honest on curvy targets).
    let scale = 1;
    let next: Maneuver = m;
    let fn: number | null = null;
    for (let k = 0; k < 8; k++) {
      next = { ...m, prograde: m.prograde - (scale * f * gp) / g2, radial: m.radial - (scale * f * gr) / g2 };
      fn = evalAt(next);
      if (fn !== null && Math.abs(fn) < Math.abs(f)) break;
      scale /= 2;
    }
    if (fn === null) return null;
    m = next;
    f = fn;
  }
  return f !== null && Math.abs(f) <= tol * 10 ? m : null;
}

/** Prograde-only magnitude solve at fixed TIG (secant on Δv). */
function solveMagnitude(now: FlightState, engine: Engine, tig: number, dv0: number, measure: Measure, goal: number, tol: number): Maneuver | null {
  const f = (dv: number) => {
    const v = measure(predictBurn(now, engine, { tig, prograde: dv, normal: 0, radial: 0 }, HORIZON));
    return v === null ? null : v - goal;
  };
  let a = dv0;
  let fa = f(a);
  let b = dv0 * 1.02 + Math.sign(dv0 || 1) * 0.5;
  let fb = f(b);
  for (let i = 0; i < 40 && fa !== null && fb !== null && Math.abs(fb) > tol; i++) {
    if (fb === fa) break;
    const c = b - (fb * (b - a)) / (fb - fa);
    a = b;
    fa = fb;
    b = c;
    fb = f(b);
  }
  return fb !== null && Math.abs(fb) <= tol * 10 ? { tig, prograde: b, normal: 0, radial: 0 } : null;
}

// --- mission burns -----------------------------------------------------------

/** Prograde Δv at a state for a transfer apoapsis at radius rA. */
function apoapsisDv(s: FlightState, rA: number): number {
  const r = s.pos.length();
  return Math.sqrt(s.primary.mu * (2 / r - 2 / (r + rA))) - s.vel.length();
}

/**
 * Trans-lunar injection: a prograde S-IVB burn sized for a ~3-day
 * transfer; the window (TIG) is found so the finite burn arrives at the
 * target perilune.
 */
export function solveTli(now: FlightState, engine: Engine, earliest = now.t + 300): Maneuver | null {
  const period = Orbit.fromState(now.pos, now.vel, now.primary.mu, now.t).period;
  // Size the burn once with the finite-burn model (a long S-IVB burn loses a
  // lot to gravity); a circular parking orbit makes that size TIG-independent.
  const apogee: Measure = (p) => Orbit.fromState(p.cutoff.pos, p.cutoff.vel, p.cutoff.primary.mu).apoapsis;
  const sized = solveMagnitude(now, engine, earliest, apoapsisDv(coastTo(now, earliest), TARGET.tliApogee), apogee, TARGET.tliApogee, 1e5);
  if (!sized) return null;
  const plan = (tig: number): Maneuver => ({ tig, prograde: sized.prograde, normal: 0, radial: 0 });
  const f = (tig: number) => {
    const p = perilune(predictBurn(now, engine, plan(tig), HORIZON).arcs);
    return p === null ? null : p - TARGET.perilune;
  };
  const tig = firstRoot(f, earliest, earliest + period, 20, 0.01);
  return tig === null ? null : plan(tig);
}

/** Midcourse correction: steer the lunar perilune onto target. */
export function solveMidcourse(now: FlightState, engine: Engine, tig: number): Maneuver | null {
  const zero: Maneuver = { tig, prograde: 0, normal: 0, radial: 0 };
  return solveInPlane(now, engine, zero, (p) => perilune(p.arcs), TARGET.perilune, 50);
}

/**
 * Circularize at the next periapsis (LOI). A long SPS burn can't null the
 * eccentricity with magnitude alone, so this is a 2-D Newton on the
 * eccentricity vector over (prograde, radial).
 */
export function solveCircularize(now: FlightState, engine: Engine): Maneuver | null {
  const orbit = Orbit.fromState(now.pos, now.vel, now.primary.mu, now.t);
  const tig = orbit.nextPeriapsis(now.t);
  if (tig === null) return null;
  const at = coastTo(now, tig);
  const u = at.pos.clone().normalize();
  const w = at.vel.clone().normalize();
  const eVec = (m: Maneuver): [number, number] => {
    const c = predictBurn(now, engine, m, 0).cutoff;
    const o = Orbit.fromState(c.pos, c.vel, c.primary.mu);
    return [o.e * o.eHat.dot(u), o.e * o.eHat.dot(w)];
  };
  let m: Maneuver = { tig, prograde: Math.sqrt(now.primary.mu / at.pos.length()) - at.vel.length(), normal: 0, radial: 0 };
  let f = eVec(m);
  for (let i = 0; i < 20 && Math.hypot(f[0], f[1]) > 1e-5; i++) {
    const h = 0.05;
    const fp = eVec({ ...m, prograde: m.prograde + h });
    const fr = eVec({ ...m, radial: m.radial + h });
    const [a, c] = [(fp[0] - f[0]) / h, (fp[1] - f[1]) / h];
    const [b, d] = [(fr[0] - f[0]) / h, (fr[1] - f[1]) / h];
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return null;
    m = { ...m, prograde: m.prograde - (d * f[0] - b * f[1]) / det, radial: m.radial - (-c * f[0] + a * f[1]) / det };
    f = eVec(m);
  }
  return Math.hypot(f[0], f[1]) < 1e-4 ? m : null;
}

/** Lower (or raise) the opposite apsis to `radius` with a burn at `tig`. */
export function solveOppositeApsis(now: FlightState, engine: Engine, tig: number, radius: number): Maneuver | null {
  const at = coastTo(now, tig);
  const r = at.pos.length();
  const dv0 = Math.sqrt(now.primary.mu * (2 / r - 2 / (r + radius))) - at.vel.length();
  const apsis = (p: BurnPrediction) => {
    const o = Orbit.fromState(p.cutoff.pos, p.cutoff.vel, p.cutoff.primary.mu);
    return radius < r ? o.periapsis : o.apoapsis;
  };
  return solveMagnitude(now, engine, tig, dv0, apsis, radius, 5);
}

/** Trans-Earth injection: a prograde burn whose window puts entry in the corridor. */
export function solveTei(now: FlightState, engine: Engine, earliest = now.t + 300): Maneuver | null {
  const period = Orbit.fromState(now.pos, now.vel, now.primary.mu, now.t).period;
  const f = (tig: number) => {
    const p = predictBurn(now, engine, { tig, prograde: TARGET.teiDeltaV, normal: 0, radial: 0 }, HORIZON);
    const arc = earthArc(p.arcs);
    // Direct returns only: the Earth leg must start falling inward.
    const inbound = arc && arc.orbit.stateAt(arc.t0, new Vector3(), vel).dot(vel) < 0;
    return arc && inbound ? entryAngle(arc.orbit) - TARGET.entryAngle : null;
  };
  const vel = new Vector3();
  const tig = firstRoot(f, earliest, earliest + period, 30, 0.01);
  return tig === null ? null : { tig, prograde: TARGET.teiDeltaV, normal: 0, radial: 0 };
}

/** Return-leg midcourse: trim the entry angle. */
export function solveEntryCorridor(now: FlightState, engine: Engine, tig: number): Maneuver | null {
  const zero: Maneuver = { tig, prograde: 0, normal: 0, radial: 0 };
  const measure: Measure = (p) => {
    const arc = earthArc(p.arcs);
    return arc ? entryAngle(arc.orbit) : null;
  };
  return solveInPlane(now, engine, zero, measure, TARGET.entryAngle, 1e-4);
}

/**
 * Terminal-phase initiation: the Lambert intercept of the target's future
 * position, with TIG chosen for the least total Δv (intercept + braking).
 */
export function solveIntercept(
  chaser: FlightState,
  target: FlightState,
  transfer: number,
  earliest = chaser.t + 120,
): { tpi: Maneuver; arrival: number; brakingDv: number } | null {
  const period = Orbit.fromState(chaser.pos, chaser.vel, chaser.primary.mu, chaser.t).period;
  let best: { tpi: Maneuver; arrival: number; brakingDv: number; cost: number } | null = null;
  // The lower orbit gains on the target each revolution; look a few ahead.
  for (let tig = earliest; tig < earliest + 3 * period; tig += 20) {
    const c = coastTo(chaser, tig);
    const arrival = tig + transfer;
    const tg = coastTo(target, arrival);
    const sol = lambert(c.pos, tg.pos, transfer, c.primary.mu, new Vector3().crossVectors(c.pos, c.vel));
    if (!sol) continue;
    const dv1 = sol.v1.clone().sub(c.vel);
    const dv2 = tg.vel.clone().sub(sol.v2).length();
    const cost = dv1.length() + dv2;
    if (!best || cost < best.cost) best = { tpi: toManeuver(tig, dv1, c), arrival, brakingDv: dv2, cost };
  }
  return best && { tpi: best.tpi, arrival: best.arrival, brakingDv: best.brakingDv };
}

/**
 * Braking: match the target's velocity `standoff` seconds before closest
 * approach, which leaves the chaser a kilometer or two short for the RCS
 * approach — never through the target.
 */
export function solveBraking(chaser: FlightState, target: FlightState, within: number, standoff = 120): Maneuver | null {
  let tca = chaser.t;
  let best = Infinity;
  for (let t = chaser.t; t < chaser.t + within; t += 5) {
    const d = coastTo(chaser, t).pos.distanceTo(coastTo(target, t).pos);
    if (d < best) {
      best = d;
      tca = t;
    }
  }
  const tig = Math.max(chaser.t + 60, tca - standoff);
  const c = coastTo(chaser, tig);
  return toManeuver(tig, coastTo(target, tig).vel.sub(c.vel), c);
}
