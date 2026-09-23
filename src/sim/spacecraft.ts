import { Quaternion, Vector3 } from 'three';
import { G0 } from '../constants';
import { VEHICLES, type StageSpec, type VehicleId } from './vehicles';

export interface RotationInput {
  pitch: number; // -1..1
  yaw: number;
  roll: number;
}

export interface TranslationInput {
  x: number; // -1..1, body frame (right +)
  y: number; // (up +)
  z: number; // (forward +)
}

export const NO_ROTATION: RotationInput = { pitch: 0, yaw: 0, roll: 0 };
export const NO_TRANSLATION: TranslationInput = { x: 0, y: 0, z: 0 };

const SAS_DAMPING = 5; // 1/s exponential rate kill
const SLEW_GAIN = 2.5; // 1/s proportional attitude-hold authority
const SLEW_MAX_RATE = 0.35; // rad/s
const FORWARD = new Vector3(0, 0, 1);

/**
 * A flyable Apollo craft with stage-aware tanks. State is relative to the
 * simulation's current primary. `attachedMass` carries a docked partner's
 * mass so burns and Δv account for the full stack.
 */
export class Spacecraft {
  readonly position = new Vector3(); // m
  readonly velocity = new Vector3(); // m/s
  readonly quaternion = new Quaternion();
  /** Body-frame angular velocity, rad/s. */
  readonly angularVelocity = new Vector3();

  /** Remaining fuel per stage, kg (parallel to spec.stages). */
  fuels: number[];
  stagesDropped = 0;
  rcsFuel: number;
  /** Commanded throttle 0..1 — the engine burns whenever this is > 0. */
  throttle = 0;
  /** Rate damping (SCS). */
  sas = true;
  attachedMass = 0;
  /** Body-fixed surface site (unit vector) while resting on a body. */
  landedSite: Vector3 | null = null;
  readonly rcsCommand = new Vector3();
  /** Engine Δv delivered since the last reset — what burn guidance meters. */
  readonly burnDv = new Vector3();

  constructor(readonly id: VehicleId) {
    const spec = VEHICLES[id];
    this.fuels = spec.stages.map((s) => s.fuelMass);
    this.rcsFuel = spec.rcsFuelMass;
  }

  get spec() {
    return VEHICLES[this.id];
  }

  get stage(): StageSpec {
    return this.spec.stages[this.stagesDropped];
  }

  get fuel(): number {
    return this.fuels[this.stagesDropped];
  }

  get fuelFraction(): number {
    return this.stage.fuelMass > 0 ? this.fuel / this.stage.fuelMass : 0;
  }

  get landed(): boolean {
    return this.landedSite !== null;
  }

  get canStage(): boolean {
    return this.stagesDropped < this.spec.stages.length - 1;
  }

  dropStage(): void {
    if (this.canStage) this.stagesDropped++;
  }

  /** Own mass: remaining stages' dry mass + fuel + RCS propellant. */
  get ownMass(): number {
    let m = this.rcsFuel;
    for (let i = this.stagesDropped; i < this.spec.stages.length; i++) {
      m += this.spec.stages[i].dryMass + this.fuels[i];
    }
    return m;
  }

  get mass(): number {
    return this.ownMass + this.attachedMass;
  }

  /** Engine exhaust velocity, m/s. */
  get exhaustVelocity(): number {
    return this.stage.isp * G0;
  }

  /** Remaining Δv on the current stage at current (stacked) mass. */
  get deltaV(): number {
    if (this.stage.thrust <= 0) return 0;
    return this.exhaustVelocity * Math.log(this.mass / (this.mass - this.fuel));
  }

  get firing(): boolean {
    return this.throttle > 0 && this.fuel > 0 && this.stage.thrust > 0;
  }

  /** Body +Z in world space — the direction the main engine pushes. */
  get forward(): Vector3 {
    return FORWARD.clone().applyQuaternion(this.quaternion);
  }

  /** Body axis (x, y or z unit) in world space. */
  axis(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).applyQuaternion(this.quaternion);
  }

  get thrustAccel(): Vector3 {
    if (!this.firing) return new Vector3();
    return this.forward.multiplyScalar((this.stage.thrust * this.throttle) / this.mass);
  }

  get rcsAccel(): Vector3 {
    if (this.rcsFuel <= 0 || this.rcsCommand.lengthSq() < 1e-6) return new Vector3();
    return this.rcsCommand
      .clone()
      .clampLength(0, 1)
      .applyQuaternion(this.quaternion)
      .multiplyScalar(this.spec.rcsThrust / this.mass);
  }

  /** Burn propellant for dt seconds at the current commands. */
  consume(dt: number): void {
    if (this.firing) {
      const mdot = (this.stage.thrust * this.throttle) / this.exhaustVelocity;
      this.fuels[this.stagesDropped] = Math.max(0, this.fuel - mdot * dt);
    }
    const rcs = Math.min(1, this.rcsCommand.length());
    if (rcs > 1e-3 && this.rcsFuel > 0) {
      const mdot = (this.spec.rcsThrust * rcs) / (this.spec.rcsIsp * G0);
      this.rcsFuel = Math.max(0, this.rcsFuel - mdot * dt);
    }
  }

  /** Manual stick: accelerate body rates; SAS damps them when released. */
  applyRotationInput(input: RotationInput, dt: number): void {
    const a = this.spec.angularAccel;
    this.angularVelocity.x += input.pitch * a * dt;
    this.angularVelocity.y += input.yaw * a * dt;
    this.angularVelocity.z += input.roll * a * dt;
    const active = input.pitch !== 0 || input.yaw !== 0 || input.roll !== 0;
    if (this.sas && !active) {
      this.angularVelocity.multiplyScalar(Math.exp(-SAS_DAMPING * dt));
      if (this.angularVelocity.lengthSq() < 1e-8) this.angularVelocity.set(0, 0, 0);
    }
  }

  integrateAttitude(dt: number): void {
    const w = this.angularVelocity;
    if (w.lengthSq() === 0) return;
    const dq = new Quaternion().setFromAxisAngle(w.clone().normalize(), w.length() * dt);
    this.quaternion.multiply(dq).normalize(); // body-frame rates post-multiply
  }

  /** Attitude hold: slew toward `target` at a proportional, rate-limited pace. */
  slewToward(target: Quaternion, dt: number): void {
    const angle = this.quaternion.angleTo(target);
    this.angularVelocity.set(0, 0, 0);
    if (angle < 1e-6) {
      this.quaternion.copy(target);
      return;
    }
    const step = Math.min(angle, Math.min(SLEW_MAX_RATE, SLEW_GAIN * angle) * dt);
    this.quaternion.slerp(target, step / angle);
  }

  /** Full tanks, all stages, facing along `facing`. */
  reset(position: Vector3, velocity: Vector3, facing = velocity): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.angularVelocity.set(0, 0, 0);
    this.stagesDropped = 0;
    this.fuels = this.spec.stages.map((s) => s.fuelMass);
    this.rcsFuel = this.spec.rcsFuelMass;
    this.throttle = 0;
    this.sas = true;
    this.attachedMass = 0;
    this.landedSite = null;
    this.rcsCommand.set(0, 0, 0);
    this.burnDv.set(0, 0, 0);
    this.pointAlong(facing);
  }

  /** Point +Z along `dir`, keeping roll minimal. */
  pointAlong(dir: Vector3): void {
    this.quaternion.setFromUnitVectors(FORWARD, dir.clone().normalize());
  }
}
