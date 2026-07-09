import { Quaternion, Vector3 } from 'three';
import { SHIP } from '../constants';

export interface RotationInput {
  pitch: number; // -1..1
  yaw: number;
  roll: number;
}

const ANGULAR_ACCEL = 0.9; // rad/s²
const SAS_DAMPING = 6; // 1/s exponential kill-rotation rate

export class Spacecraft {
  /** World position, meters. */
  readonly position = new Vector3();
  /** World velocity, m/s. */
  readonly velocity = new Vector3();
  readonly quaternion = new Quaternion();
  /** Body-frame angular velocity, rad/s. */
  readonly angularVelocity = new Vector3();

  fuel = SHIP.fuelMass; // kg
  throttle = 1; // 0..1
  firing = false;
  sas = false;

  get mass(): number {
    return SHIP.dryMass + this.fuel;
  }

  /** Remaining delta-v via Tsiolkovsky, m/s. */
  get deltaV(): number {
    return SHIP.isp * SHIP.g0 * Math.log(this.mass / SHIP.dryMass);
  }

  /** Body +Z in world space — the direction thrust pushes the ship. */
  get forward(): Vector3 {
    return new Vector3(0, 0, 1).applyQuaternion(this.quaternion);
  }

  /** Thrust acceleration in world space right now (zero when idle or dry). */
  get thrustAccel(): Vector3 {
    if (!this.firing || this.throttle <= 0 || this.fuel <= 0) return new Vector3();
    return this.forward.multiplyScalar((SHIP.thrust * this.throttle) / this.mass);
  }

  consumeFuel(dt: number): void {
    if (!this.firing || this.throttle <= 0 || this.fuel <= 0) return;
    const mdot = (SHIP.thrust * this.throttle) / (SHIP.isp * SHIP.g0);
    this.fuel = Math.max(0, this.fuel - mdot * dt);
  }

  applyRotationInput(input: RotationInput, dt: number): void {
    this.angularVelocity.x += input.pitch * ANGULAR_ACCEL * dt;
    this.angularVelocity.y += input.yaw * ANGULAR_ACCEL * dt;
    this.angularVelocity.z += input.roll * ANGULAR_ACCEL * dt;

    const inputActive = input.pitch !== 0 || input.yaw !== 0 || input.roll !== 0;
    if (this.sas && !inputActive) {
      this.angularVelocity.multiplyScalar(Math.exp(-SAS_DAMPING * dt));
      if (this.angularVelocity.lengthSq() < 1e-8) this.angularVelocity.set(0, 0, 0);
    }
  }

  updateAttitude(dt: number): void {
    const w = this.angularVelocity;
    if (w.lengthSq() === 0) return;
    const angle = w.length() * dt;
    const dq = new Quaternion().setFromAxisAngle(w.clone().normalize(), angle);
    // Post-multiply: angular velocity lives in the body frame.
    this.quaternion.multiply(dq).normalize();
  }

  reset(position: Vector3, velocity: Vector3): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.angularVelocity.set(0, 0, 0);
    this.fuel = SHIP.fuelMass;
    this.throttle = 1;
    this.firing = false;
    this.sas = false;
    // Face prograde.
    this.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), velocity.clone().normalize());
  }
}
