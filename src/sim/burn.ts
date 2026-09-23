import { Vector3 } from 'three';
import type { Body } from './bodies';
import { crossSoi, nextEvent, predictPath, type Arc } from './coast';
import { Orbit } from './orbit';
import { orbitalFrame, rk4Step } from './physics';
import type { Spacecraft } from './spacecraft';

/** A craft's translational state about a primary at time t. */
export interface FlightState {
  primary: Body;
  pos: Vector3;
  vel: Vector3;
  t: number;
}

/** What a burn is flown on: the active engine at the current mass. */
export interface Engine {
  thrust: number; // N
  ve: number; // exhaust velocity, m/s
  mass: number; // kg at ignition
}

/**
 * A planned burn. Δv is given in the orbital frame of the coast state at
 * TIG; the burn is flown centered on TIG along that fixed inertial direction.
 */
export interface Maneuver {
  tig: number;
  prograde: number;
  normal: number;
  radial: number;
}

export function engineOf(ship: Spacecraft): Engine {
  return { thrust: ship.stage.thrust, ve: ship.exhaustVelocity, mass: ship.mass };
}

export function magnitude(m: Maneuver): number {
  return Math.hypot(m.prograde, m.normal, m.radial);
}

/** Full-throttle burn time for Δv (Tsiolkovsky). */
export function burnTime(engine: Engine, dv: number): number {
  if (engine.thrust <= 0) return Infinity;
  const propellant = engine.mass * (1 - Math.exp(-dv / engine.ve));
  return propellant / (engine.thrust / engine.ve);
}

/** Coast a state (patched conics) to time t. */
export function coastTo(s: FlightState, t: number): FlightState {
  const pos = s.pos.clone();
  const vel = s.vel.clone();
  let primary = s.primary;
  let now = s.t;
  for (let guard = 0; guard < 8 && now < t; guard++) {
    const orbit = Orbit.fromState(pos, vel, primary.mu, now);
    const ev = nextEvent(orbit, primary, now, t);
    const stop = ev && (ev.kind === 'soi-enter' || ev.kind === 'soi-exit') ? ev.t : t;
    orbit.stateAt(stop, pos, vel);
    now = stop;
    if (stop < t && ev) primary = crossSoi(ev.kind as 'soi-enter' | 'soi-exit', pos, vel, stop);
  }
  return { primary, pos, vel, t: Math.max(now, t) };
}

/** World-frame Δv vector of a maneuver, in the frame of the coast state at TIG. */
export function burnVector(m: Maneuver, atTig: FlightState): Vector3 {
  const f = orbitalFrame(atTig.pos, atTig.vel);
  return f.prograde
    .multiplyScalar(m.prograde)
    .addScaledVector(f.normal, m.normal)
    .addScaledVector(f.radial, m.radial);
}

/** Orbital-frame components of a world Δv at a state. */
export function toManeuver(tig: number, dv: Vector3, at: FlightState): Maneuver {
  const f = orbitalFrame(at.pos, at.vel);
  return { tig, prograde: dv.dot(f.prograde), normal: dv.dot(f.normal), radial: dv.dot(f.radial) };
}

/**
 * Fly a burn of `dv` along a fixed direction from `start` (numerically, with
 * mass flow) and return the cutoff state.
 */
export function integrateBurn(start: FlightState, engine: Engine, dv: Vector3, step = 1): FlightState {
  const pos = start.pos.clone();
  const vel = start.vel.clone();
  const dir = dv.clone().normalize();
  const total = dv.length();
  let mass = engine.mass;
  let delivered = 0;
  let t = start.t;
  const mdot = engine.thrust / engine.ve;
  while (delivered < total - 1e-6) {
    // Step to exactly the mass at which the target Δv is reached.
    const massAtCutoff = engine.mass * Math.exp(-total / engine.ve);
    const h = Math.min(step, (mass - massAtCutoff) / mdot);
    if (h <= 1e-9) break;
    // Thrust at the step's mid-point mass: second-order accurate in mass flow.
    const accel = dir.clone().multiplyScalar(engine.thrust / (mass - (mdot * h) / 2));
    rk4Step(pos, vel, h, () => accel, start.primary.mu);
    mass -= mdot * h;
    delivered = engine.ve * Math.log(engine.mass / mass);
    t += h;
  }
  return { primary: start.primary, pos, vel, t };
}

export interface BurnPrediction {
  /** Coast state at TIG (impulsive point). */
  atTig: FlightState;
  ignition: number;
  duration: number;
  /** State at engine cutoff. */
  cutoff: FlightState;
  /** Patched-conic path after cutoff. */
  arcs: Arc[];
}

/** Predict a maneuver flown as planned: ignite at TIG − T/2, hold, cut off at Δv. */
export function predictBurn(now: FlightState, engine: Engine, m: Maneuver, horizon: number): BurnPrediction {
  const atTig = coastTo(now, Math.max(now.t, m.tig));
  const dv = burnVector(m, atTig);
  const duration = burnTime(engine, dv.length());
  const ignition = Math.max(now.t, m.tig - duration / 2);
  const cutoff = integrateBurn(coastTo(now, ignition), engine, dv);
  const arcs = predictPath(cutoff.primary, cutoff.pos, cutoff.vel, cutoff.t, cutoff.t + horizon);
  return { atTig, ignition, duration, cutoff, arcs };
}

/** Predicted path with no burn. */
export function predictCoast(now: FlightState, horizon: number): Arc[] {
  return predictPath(now.primary, now.pos, now.vel, now.t, now.t + horizon);
}

export function stateOf(ship: Spacecraft, primary: Body, t: number): FlightState {
  return { primary, pos: ship.position.clone(), vel: ship.velocity.clone(), t };
}
