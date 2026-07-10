import { Quaternion, Vector3 } from 'three';
import { G0 } from './vehicles';
import type { Spacecraft } from './spacecraft';
import {
  elementsFromState,
  meanMotion,
  meanToTrueAnomaly,
  stateAtTrueAnomaly,
  trueToMeanAnomaly,
  type OrbitalElements,
} from './physics';
import type { Simulation } from './simulation';

export interface NodeState {
  position: Vector3;
  velocity: Vector3;
}

const MAX_COMPONENT_DV = 6000; // m/s — room to plan a full TLI on one node
const ALIGN_RATE = 1.8; // 1/s slerp authority while auto-aligning
const ALIGN_RELEASE_DEG = 0.4;

/**
 * Single-node maneuver planner (ported from the Apollo build):
 * a node holds TIG (absolute MET) plus prograde/normal/radial ΔV in the
 * orbital frame at the node. Burns are finite SPS burns centered on TIG,
 * auto-aligned, with delivered ΔV measured from actual mass change
 * (Tsiolkovsky), so fuel depletion is respected.
 */
export class ManeuverPlanner {
  active = false;
  tigMet = 0;
  prograde = 0;
  normal = 0;
  radial = 0;

  autoAlign = false;
  armed = false;
  burnActive = false;
  predicted: OrbitalElements | null = null;

  private burnTotalDv = 0;
  private burnMassBefore = 0;
  /** One-frame event strings, drained by the caller. */
  events: string[] = [];

  get totalDv(): number {
    return Math.hypot(this.prograde, this.normal, this.radial);
  }

  create(sim: Simulation, timeFromNow = 120): void {
    this.active = true;
    this.tigMet = sim.met + timeFromNow;
    this.prograde = this.normal = this.radial = 0;
    this.predicted = null;
  }

  clear(): void {
    this.active = false;
    this.armed = false;
    this.burnActive = false;
    this.autoAlign = false;
    this.predicted = null;
    this.prograde = this.normal = this.radial = 0;
  }

  adjust(axis: 'prograde' | 'normal' | 'radial', delta: number): void {
    this[axis] = Math.max(-MAX_COMPONENT_DV, Math.min(MAX_COMPONENT_DV, this[axis] + delta));
  }

  adjustTig(sim: Simulation, delta: number): void {
    const period = isFinite(sim.elements.period) ? sim.elements.period : 3600;
    this.tigMet = Math.min(sim.met + period * 2, Math.max(sim.met + 5, this.tigMet + delta));
  }

  /** Snap TIG to now / next apoapsis / next periapsis. */
  setTigAt(sim: Simulation, where: 'now' | 'ap' | 'pe'): void {
    if (where === 'now') {
      this.tigMet = sim.met + 15;
      return;
    }
    const el = sim.elements;
    if (!isFinite(el.period)) return;
    const n = meanMotion(el);
    const mNow = trueToMeanAnomaly(el.trueAnomaly, el.eccentricity);
    const mTarget = where === 'pe' ? 0 : Math.PI;
    let dM = mTarget - mNow;
    while (dM <= 0) dM += Math.PI * 2;
    this.tigMet = sim.met + dM / n;
  }

  timeToNode(sim: Simulation): number {
    return this.tigMet - sim.met;
  }

  /** Coast state at the node (Kepler propagation of the current orbit). */
  nodeState(sim: Simulation): NodeState {
    const el = sim.elements;
    const dt = Math.max(0, this.timeToNode(sim));
    const M = trueToMeanAnomaly(el.trueAnomaly, el.eccentricity) + meanMotion(el) * dt;
    const nu = meanToTrueAnomaly(M, el.eccentricity);
    const velocity = new Vector3();
    const position = stateAtTrueAnomaly(el, nu, velocity);
    return { position, velocity };
  }

  /** Burn vector in world space at the node. */
  burnVector(sim: Simulation): Vector3 {
    const { position, velocity } = this.nodeState(sim);
    return this.frameVector(position, velocity);
  }

  /** ΔV components combined in the orbital frame of the given state. */
  private frameVector(position: Vector3, velocity: Vector3): Vector3 {
    const prograde = velocity.clone().normalize();
    const normal = new Vector3().crossVectors(position, velocity).normalize();
    const radialOut = new Vector3().crossVectors(prograde, normal).normalize();
    return new Vector3()
      .addScaledVector(prograde, this.prograde)
      .addScaledVector(normal, this.normal)
      .addScaledVector(radialOut, this.radial);
  }

  /** Orbit that results from the burn. */
  predict(sim: Simulation): void {
    if (!this.active || this.totalDv < 0.01) {
      this.predicted = null;
      return;
    }
    const { position, velocity } = this.nodeState(sim);
    velocity.add(this.frameVector(position, velocity));
    this.predicted = elementsFromState(position, velocity);
  }

  /** Full-throttle burn duration for the node's ΔV on the craft's engine. */
  estimateBurnTime(ship: Spacecraft): number {
    const ve = ship.stage.isp * G0;
    const propellant = ship.mass * (1 - Math.exp(-this.totalDv / ve));
    const mdot = ship.stage.thrust / ve;
    return propellant / mdot;
  }

  alignmentErrorDeg(sim: Simulation): number {
    const dir = this.burnVector(sim);
    if (dir.lengthSq() < 1e-9) return 0;
    return (sim.ship.forward.angleTo(dir.normalize()) * 180) / Math.PI;
  }

  /** Arm the node: auto-align now, ignite automatically centered on TIG. */
  execute(sim: Simulation): void {
    if (!this.active || this.totalDv < 0.01) {
      this.events.push('NO BURN PLANNED');
      return;
    }
    this.armed = true;
    this.autoAlign = true;
    this.events.push(`BURN ARMED — TIG ${Math.max(0, Math.round(this.timeToNode(sim)))}s`);
  }

  /**
   * Per-frame planner logic. Returns whether the engine must fire this frame.
   * Call before integrating physics; frameDt is real (unwarped) seconds.
   */
  update(sim: Simulation, frameDt: number): boolean {
    if (!this.active) return false;
    const ship = sim.ship;

    // Expire nodes that drift a full period behind without being armed.
    if (!this.armed && this.timeToNode(sim) < -30) {
      this.clear();
      this.events.push('NODE EXPIRED');
      return false;
    }

    if (this.autoAlign && !this.burnActive) this.stepAlign(sim, frameDt);

    if (this.armed && !this.burnActive) {
      const halfBurn = this.estimateBurnTime(ship) / 2;
      if (this.timeToNode(sim) <= halfBurn) {
        if (sim.warp > 1) {
          sim.setWarpIndex(0);
          this.events.push('WARP CANCELLED — IGNITION');
        }
        this.burnActive = true;
        this.burnTotalDv = this.totalDv;
        this.burnMassBefore = ship.mass;
        ship.throttle = 1;
        this.events.push('SPS IGNITION');
      } else if (this.timeToNode(sim) <= halfBurn + 12 && sim.warp > 5) {
        sim.setWarpIndex(0); // give the countdown its last seconds at 1×
      }
    }

    if (this.burnActive) {
      this.stepAlign(sim, frameDt);
      const delivered = ship.stage.isp * G0 * Math.log(this.burnMassBefore / ship.mass);
      const remaining = this.burnTotalDv - delivered;
      if (remaining <= 0.05 || ship.fuel <= 0) {
        this.finishBurn(sim, ship.fuel <= 0);
        return false;
      }
      // Feather the throttle for the last moments so we don't overshoot.
      const fullAccel = (ship.stage.thrust / ship.mass) * frameDt;
      ship.throttle = Math.min(1, Math.max(0.05, remaining / Math.max(fullAccel, 1e-6)));
      return true;
    }

    return false;
  }

  private stepAlign(sim: Simulation, frameDt: number): void {
    const ship = sim.ship;
    const dir = this.burnVector(sim);
    if (dir.lengthSq() < 1e-9) return;
    const target = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir.normalize());
    ship.quaternion.slerp(target, 1 - Math.exp(-ALIGN_RATE * frameDt));
    ship.angularVelocity.set(0, 0, 0);
    if (!this.burnActive && this.alignmentErrorDeg(sim) < ALIGN_RELEASE_DEG && !this.armed) {
      this.autoAlign = false;
    }
  }

  private finishBurn(sim: Simulation, ranDry: boolean): void {
    sim.ship.throttle = 1;
    this.events.push(ranDry ? 'SPS CUTOFF — PROPELLANT DEPLETED' : 'SPS CUTOFF — NODE COMPLETE');
    this.clear();
  }
}
