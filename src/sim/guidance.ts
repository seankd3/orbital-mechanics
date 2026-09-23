import { Vector3 } from 'three';
import { G0 } from '../constants';
import { spinRate, type Body } from './bodies';
import { CM_AERO } from './vehicles';
import type { Simulation } from './simulation';
import type { Spacecraft, TranslationInput } from './spacecraft';

/** A powered-flight cue: where to point the engine and how hard to burn. */
export interface PoweredCue {
  dir: Vector3;
  throttle: number;
  phase: string;
  /** Time to go in the current phase, s. */
  tgo: number;
}

const Y = new Vector3(0, 1, 0);

/** Surface-relative local frame: altitude, vertical and horizontal speed. */
export function localFrame(ship: Spacecraft, body: Body) {
  const r = ship.position.length();
  const up = ship.position.clone().divideScalar(r);
  const surface = new Vector3().crossVectors(Y, ship.position).multiplyScalar(spinRate(body));
  const v = ship.velocity.clone().sub(surface);
  const vz = v.dot(up);
  const vhVec = v.clone().addScaledVector(up, -vz);
  const vh = vhVec.length();
  // Effective gravity: gravity less the centrifugal relief of orbital speed.
  const vhInertial = ship.velocity.clone().addScaledVector(up, -ship.velocity.dot(up)).length();
  const gEff = body.mu / (r * r) - (vhInertial * vhInertial) / r;
  return { r, up, h: r - body.radius, vz, vhVec, vh, gEff };
}

/**
 * Two-point boundary guidance (E-guidance): the linear-acceleration profile
 * that reaches altitude hf at vertical speed vzf in tgo seconds, while
 * nulling horizontal speed to vhf. `tgo` is picked so the demand uses
 * `margin` of the engine.
 */
function boundaryGuidance(
  f: ReturnType<typeof localFrame>,
  downrange: Vector3,
  target: { h: number; vz: number; vh: number },
  aMax: number,
  margin: number,
): { accel: Vector3; tgo: number } {
  const vhAlong = f.vhVec.dot(downrange);
  const cross = f.vhVec.clone().addScaledVector(downrange, -vhAlong);
  const demand = (T: number) => {
    const az = (6 * (target.h - f.h)) / (T * T) - (4 * f.vz + 2 * target.vz) / T + f.gEff;
    return f.up
      .clone()
      .multiplyScalar(az)
      .addScaledVector(downrange, (target.vh - vhAlong) / T)
      .addScaledVector(cross, -1 / T);
  };
  let lo = 1;
  let hi = 4000;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    if (demand(mid).length() > margin * aMax) lo = mid;
    else hi = mid;
  }
  return { accel: demand(hi), tgo: hi };
}

function cue(accel: Vector3, aMax: number, phase: string, tgo: number): PoweredCue {
  return { dir: accel.clone().normalize(), throttle: Math.min(1, accel.length() / aMax), phase, tgo };
}

/** Lunar Module powered descent: braking (P63) to low gate, then P66 to contact. */
export function descentGuidance(ship: Spacecraft, body: Body): PoweredCue {
  const f = localFrame(ship, body);
  const aMax = ship.stage.thrust / ship.mass;
  const downrange = f.vh > 0.5 ? f.vhVec.clone().normalize() : new Vector3().crossVectors(f.up, Y).normalize();
  if (f.h > 250) {
    const g = boundaryGuidance(f, downrange, { h: 120, vz: -3, vh: 0 }, aMax, 0.8);
    if (g.tgo > 8) return cue(g.accel, aMax, f.h > 2_000 ? 'P63 BRAKING' : 'P64 APPROACH', g.tgo);
  }
  // P66: rate-of-descent control, horizontal nulling, nearly upright.
  // Drifting fast? Slow the descent (hover-ish) until the drift is killed.
  const drift = Math.min(1, 3 / Math.max(f.vh, 1e-6));
  const vzCmd = -Math.min(3, Math.max(0.7, f.h / 25)) * Math.max(0.15, drift);
  return p66(f, aMax, vzCmd);
}

/** P66 attitude + throttle for a commanded sink rate (vz, m/s, negative down). */
export function p66(f: ReturnType<typeof localFrame>, aMax: number, vzCmd: number): PoweredCue {
  const az = 1.2 * (vzCmd - f.vz) + f.gEff;
  const lateral = f.vhVec.clone().multiplyScalar(-0.6);
  lateral.clampLength(0, 0.45 * Math.max(az, 0.5));
  const accel = f.up.clone().multiplyScalar(Math.max(0, az)).add(lateral);
  return cue(accel, aMax, 'P66 LAND', f.h / Math.max(0.5, -f.vz));
}

/**
 * LM ascent (P12): vertical rise, then boundary guidance to insertion
 * (altitude, zero sink, orbital speed) in the given orbit plane.
 */
export function ascentGuidance(
  ship: Spacecraft,
  body: Body,
  planeNormal: Vector3,
  insertion: { radius: number; speed: number },
): PoweredCue & { toGo: number } {
  const f = localFrame(ship, body);
  const aMax = ship.stage.thrust / ship.mass;
  const downrange = new Vector3().crossVectors(planeNormal, f.up).normalize();
  const vhInertial = ship.velocity.dot(downrange);
  const toGo = insertion.speed - vhInertial;
  if (f.h < 150) return { ...cue(f.up, aMax, 'P12 VERTICAL RISE', 0), throttle: 1, toGo };
  // Boundary guidance in inertial horizontal speed (the orbit cares, not the ground).
  const frame = { ...f, vhVec: ship.velocity.clone().addScaledVector(f.up, -ship.velocity.dot(f.up)) };
  const g = boundaryGuidance(frame, downrange, { h: insertion.radius - body.radius, vz: 0, vh: insertion.speed }, aMax, 1);
  return { ...cue(g.accel, aMax, 'P12 ASCENT', g.tgo), throttle: 1, toGo };
}

/**
 * Entry bank guidance: constant-drag tracking on the lift vector. Picks the
 * vertical acceleration that steers altitude rate toward a drag-dependent
 * reference (dive while light, climb while heavy), then solves for the
 * lift fraction that produces it — above circular speed that means lift
 * *down* just to stay in the air. Returns the desired bank magnitude
 * (0 = lift up, π = lift down).
 */
export function entryBank(sim: Simulation, targetG = 4): { bank: number; targetG: number } {
  const ship = sim.ship;
  const r = ship.position.length();
  const up = ship.position.clone().divideScalar(r);
  const speed = ship.velocity.length();
  const hDot = ship.velocity.dot(up);
  const drag = (sim.gLoad * G0) / Math.sqrt(1 + CM_AERO.liftToDrag ** 2);
  const lift = CM_AERO.liftToDrag * drag;
  if (speed < 1_500 || lift < 0.05) return { bank: 0, targetG };
  const hDotRef = Math.max(-150, Math.min(150, 60 * (sim.gLoad - targetG)));
  const want = 0.12 * (hDotRef - hDot);
  const vh2 = speed * speed - hDot * hDot;
  const gravity = sim.primary.mu / (r * r);
  const u = (want + gravity - vh2 / r + (drag * hDot) / speed) / lift;
  return { bank: Math.acos(Math.max(-1, Math.min(1, u))), targetG };
}

/** Current bank: angle of the lift vector from local vertical (signed, rad). */
export function currentBank(sim: Simulation): number {
  const ship = sim.ship;
  const v = ship.velocity.clone().normalize();
  const up = ship.position.clone().normalize();
  const upPerp = up.addScaledVector(v, -up.dot(v)).normalize();
  const lift = sim.liftDirection();
  const s = new Vector3().crossVectors(upPerp, lift).dot(v);
  return Math.atan2(s, upPerp.dot(lift));
}

/**
 * Proximity-operations autopilot: close along the line of sight at a
 * range-scheduled rate, null lateral drift. RCS command in the body frame.
 */
export function dockingGuidance(sim: Simulation): { translation: TranslationInput; closing: number; desired: number } | null {
  const rel = sim.relative();
  if (!rel) return null;
  const ship = sim.ship;
  const los = rel.pos.clone().normalize();
  const desired = Math.min(6, Math.max(0.25, rel.range / 60));
  const w = rel.vel.clone().negate(); // our velocity relative to the target
  const accel = los.clone().multiplyScalar(desired).sub(w).multiplyScalar(0.5);
  const aRcs = ship.spec.rcsThrust / ship.mass;
  const body = accel.divideScalar(aRcs).applyQuaternion(ship.quaternion.clone().invert());
  const dead = (x: number) => (Math.abs(x) < 0.03 ? 0 : Math.max(-1, Math.min(1, x)));
  return {
    translation: { x: dead(body.x), y: dead(body.y), z: dead(body.z) },
    closing: -rel.rangeRate,
    desired,
  };
}

