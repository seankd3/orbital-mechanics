import { Quaternion, Vector3 } from 'three';
import { G0, VEHICLES, type StageSpec, type VehicleId } from './vehicles';

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

const SAS_DAMPING = 6; // 1/s exponential kill-rotation rate

/**
 * A flyable Apollo craft (CSM or LM) with stage-aware tanks. State is
 * relative to the simulation's current primary. `attachedMass` carries the
 * docked partner's mass so burns and Δv account for the full stack.
 */
export class Spacecraft {
  readonly position = new Vector3(); // m
  readonly velocity = new Vector3(); // m/s
  readonly quaternion = new Quaternion();
  /** Body-frame angular velocity, rad/s. */
  readonly angularVelocity = new Vector3();

  /** Remaining fuel per stage, kg (parallel to spec.stages). */
  fuels: number[];
  /** Stages already dropped (LM leaves its descent stage on the Moon). */
  stagesDropped = 0;
  rcsFuel: number;
  throttle = 1; // 0..1
  firing = false;
  sas = false;
  /** Mass of a docked partner riding along, kg. */
  attachedMass = 0;
  landed = false;
  readonly rcsCommand = new Vector3();

  constructor(readonly id: VehicleId) {
    const spec = VEHICLES[id];
    this.fuels = spec.stages.map((s) => s.fuelMass);
    this.rcsFuel = spec.rcsFuelMass;
  }

  get spec() {
    return VEHICLES[this.id];
  }

  /** The stage currently feeding the engine. */
  get stage(): StageSpec {
    return this.spec.stages[this.stagesDropped];
  }

  get fuel(): number {
    return this.fuels[this.stagesDropped];
  }
  set fuel(v: number) {
    this.fuels[this.stagesDropped] = v;
  }

  get canStage(): boolean {
    return this.stagesDropped < this.spec.stages.length - 1;
  }

  /** Drop the current stage (LM descent stage stays behind). */
  dropStage(): void {
    if (this.canStage) this.stagesDropped++;
  }

  /** Own mass: remaining stages' dry mass + their fuel + RCS propellant. */
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

  /** Remaining Δv on the current stage at current (stacked) mass. */
  get deltaV(): number {
    const dry = this.mass - this.fuel;
    return this.stage.isp * G0 * Math.log(this.mass / dry);
  }

  /** Body +Z in world space — the direction thrust pushes the craft. */
  get forward(): Vector3 {
    return new Vector3(0, 0, 1).applyQuaternion(this.quaternion);
  }

  get thrustAccel(): Vector3 {
    if (!this.firing || this.throttle <= 0 || this.fuel <= 0) return new Vector3();
    return this.forward.multiplyScalar((this.stage.thrust * this.throttle) / this.mass);
  }

  consumeFuel(dt: number): void {
    if (!this.firing || this.throttle <= 0 || this.fuel <= 0) return;
    const mdot = (this.stage.thrust * this.throttle) / (this.stage.isp * G0);
    this.fuel = Math.max(0, this.fuel - mdot * dt);
  }

  get rcsAccel(): Vector3 {
    if (this.rcsFuel <= 0 || this.rcsCommand.lengthSq() < 1e-6) return new Vector3();
    return this.rcsCommand
      .clone()
      .normalize()
      .applyQuaternion(this.quaternion)
      .multiplyScalar(this.spec.rcsThrust / this.mass);
  }

  consumeRcsFuel(dt: number): void {
    if (this.rcsFuel <= 0 || this.rcsCommand.lengthSq() < 1e-6) return;
    const mdot = this.spec.rcsThrust / (this.spec.rcsIsp * G0);
    this.rcsFuel = Math.max(0, this.rcsFuel - mdot * dt);
  }

  applyRotationInput(input: RotationInput, dt: number): void {
    const a = this.spec.angularAccel;
    this.angularVelocity.x += input.pitch * a * dt;
    this.angularVelocity.y += input.yaw * a * dt;
    this.angularVelocity.z += input.roll * a * dt;

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
    const spec = this.spec;
    this.stagesDropped = 0;
    this.fuels = spec.stages.map((s) => s.fuelMass);
    this.rcsFuel = spec.rcsFuelMass;
    this.throttle = 1;
    this.firing = false;
    this.sas = false;
    this.attachedMass = 0;
    this.landed = false;
    this.rcsCommand.set(0, 0, 0);
    // Face prograde.
    this.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), velocity.clone().normalize());
  }
}
