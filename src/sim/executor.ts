import { Matrix4, Quaternion, Vector3 } from 'three';
import { burnTime, burnVector, coastTo, engineOf, type FlightState, type Maneuver } from './burn';
import type { Spacecraft } from './spacecraft';

export type BurnPhase = 'pending' | 'burning' | 'paused' | 'done';

/** Δv-to-go below which a burn counts as flown to completion. */
export const BURN_DONE = 0.05; // m/s

/**
 * Flies a planned maneuver: freezes its inertial Δv vector at arming, then
 * meters what the engine actually delivers. The cue is always the
 * velocity-to-be-gained, so a small misalignment corrects itself the way
 * Apollo's cross-product steering did.
 */
export class BurnGuide {
  readonly target: Vector3;
  readonly ignition: number;
  readonly duration: number;
  phase: BurnPhase = 'pending';
  /** MET at first ignition, if lit. */
  litAt: number | null = null;

  constructor(
    readonly maneuver: Maneuver,
    now: FlightState,
    ship: Spacecraft,
  ) {
    this.target = burnVector(maneuver, coastTo(now, Math.max(now.t, maneuver.tig)));
    this.duration = burnTime(engineOf(ship), this.target.length());
    this.ignition = maneuver.tig - this.duration / 2;
  }

  get total(): number {
    return this.target.length();
  }

  /** Velocity still to be gained (world vector). */
  toGo(ship: Spacecraft): Vector3 {
    return this.litAt === null ? this.target.clone() : this.target.clone().sub(ship.burnDv);
  }

  /** Signed Δv-to-go along the burn line: negative means overburn. */
  remaining(ship: Spacecraft): number {
    return this.toGo(ship).dot(this.target) / Math.max(this.total, 1e-9);
  }

  cue(ship: Spacecraft): Vector3 {
    const v = this.toGo(ship);
    return v.lengthSq() > 1e-8 ? v.normalize() : this.target.clone().normalize();
  }

  /** Track ignition and cutoff. Call once per frame. */
  update(ship: Spacecraft, met: number): void {
    if (this.phase === 'done') return;
    if (this.litAt === null && !ship.firing) {
      // Keep the meter zeroed until the engine lights, so the first
      // burning step is counted.
      ship.burnDv.set(0, 0, 0);
      return;
    }
    if (ship.firing) {
      this.litAt ??= met;
      this.phase = 'burning';
    } else if (this.phase === 'burning') {
      this.phase = this.remaining(ship) < BURN_DONE ? 'done' : 'paused';
    }
  }

  /** Mark a paused (under-)burn as accepted. */
  accept(): void {
    this.phase = 'done';
  }

  /**
   * P40 autopilot for this burn: attitude to the cue, ignite at the
   * ignition time, full thrust to a cutoff timed inside the last step
   * (`dt` = sim seconds per step) so it flies exactly what was predicted.
   */
  autopilot(ship: Spacecraft, met: number, dt: number): { hold: Quaternion; throttle: number } {
    const hold = pointQuaternion(ship, this.cue(ship));
    if (this.phase === 'done') return { hold, throttle: 0 };
    const aligned = ship.forward.angleTo(this.cue(ship)) < (2 * Math.PI) / 180;
    const lit = this.litAt !== null;
    if (!lit && (met + dt <= this.ignition || !aligned)) return { hold, throttle: 0 };
    const left = this.remaining(ship);
    if (left < BURN_DONE / 2) return { hold, throttle: 0 };
    const accel = ship.stage.thrust / ship.mass;
    // Both ends of the burn are timed inside a step: partial throttle on the
    // igniting step, and on the step that reaches the target Δv.
    const onFor = lit ? dt : Math.min(dt, met + dt - this.ignition);
    return { hold, throttle: Math.min(onFor / dt, left / (accel * dt)) };
  }
}

/** Minimal rotation from the current attitude that points +Z along `dir`. */
export function pointQuaternion(ship: Spacecraft, dir: Vector3): Quaternion {
  const turn = new Quaternion().setFromUnitVectors(ship.forward, dir.clone().normalize());
  return turn.multiply(ship.quaternion).normalize();
}

/** Point +Z along `dir` with body +Y as close as possible to `up`. */
export function lookQuaternion(dir: Vector3, up: Vector3): Quaternion {
  const z = dir.clone().normalize();
  const x = new Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-10) x.set(1, 0, 0).cross(z);
  x.normalize();
  const y = new Vector3().crossVectors(z, x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}
