import { Quaternion, Vector3 } from 'three';
import { MOON } from '../constants';
import { MOON_BODY } from './bodies';
import { G0 } from './vehicles';
import type { Simulation } from './simulation';

export type HoldMode =
  | 'prograde'
  | 'retrograde'
  | 'radial-out'
  | 'radial-in'
  | 'normal-plus'
  | 'normal-minus';

interface AssistBurn {
  label: string;
  mode: HoldMode;
  totalDv: number;
  massBefore: number;
}

const HOLD_RATE = 1.8; // 1/s slerp authority

export const HOLD_LABELS: Record<HoldMode, string> = {
  prograde: 'PRO',
  retrograde: 'RETRO',
  'radial-out': 'RAD+',
  'radial-in': 'RAD−',
  'normal-plus': 'NORM+',
  'normal-minus': 'NORM−',
};

/**
 * Apollo orbit-ops assists (ported from mission.js): continuous attitude
 * holds and guided SPS burns. Solved burns (TLI, CIRC) compute their ΔV from
 * the current state; LOI/TEI use the Apollo build's fixed magnitudes. Burns
 * are closed-loop against realized mass flow (Tsiolkovsky), then settle
 * into a hold — the classic "MISSION HOLD PRO" state.
 */
export class ApolloOps {
  hold: HoldMode | null = null;
  burn: AssistBurn | null = null;
  events: string[] = [];

  get statusLabel(): string {
    if (this.burn) return `${this.burn.label} BURN`;
    if (this.hold) return `HOLD ${HOLD_LABELS[this.hold]}`;
    return 'MANUAL';
  }

  setHold(mode: HoldMode): void {
    this.hold = mode;
    this.events.push(`ATTITUDE HOLD ${HOLD_LABELS[mode]}`);
  }

  clearGuidance(quiet = false): void {
    if (!quiet && (this.hold || this.burn)) this.events.push('GUIDANCE OFF — MANUAL');
    this.hold = null;
    this.burn = null;
  }

  /** Solved trans-lunar injection: Hohmann departure to the Moon's radius. */
  startTli(sim: Simulation): void {
    if (sim.primary === MOON_BODY) {
      this.events.push('TLI UNAVAILABLE IN LUNAR SOI');
      return;
    }
    const r = sim.ship.position.length();
    const a = (r + MOON.orbitRadius) / 2;
    const vNeeded = Math.sqrt(sim.primary.mu * (2 / r - 1 / a));
    const dv = vNeeded - sim.ship.velocity.length();
    if (dv <= 0) {
      this.events.push('TLI: ALREADY AT DEPARTURE ENERGY');
      return;
    }
    this.startBurn(sim, 'TLI', dv, 'prograde');
  }

  /** Solved circularization at the current radius. */
  startCircularize(sim: Simulation): void {
    const r = sim.ship.position.length();
    const vCirc = Math.sqrt(sim.primary.mu / r);
    const dv = vCirc - sim.ship.velocity.length();
    if (Math.abs(dv) < 0.5) {
      this.events.push('CIRC: ALREADY CIRCULAR');
      return;
    }
    this.startBurn(sim, 'CIRC', Math.abs(dv), dv > 0 ? 'prograde' : 'retrograde');
  }

  /** Fixed lunar-orbit-insertion retro burn (Apollo-build magnitude). */
  startLoi(sim: Simulation): void {
    this.startBurn(sim, 'LOI', 900, 'retrograde');
  }

  /** Fixed trans-Earth-injection prograde burn. */
  startTei(sim: Simulation): void {
    this.startBurn(sim, 'TEI', 1000, 'prograde');
  }

  private startBurn(sim: Simulation, label: string, dv: number, mode: HoldMode): void {
    sim.planner.clear();
    if (sim.warp > 1) sim.setWarpIndex(0);
    this.hold = mode;
    this.burn = { label, mode, totalDv: dv, massBefore: sim.ship.mass };
    sim.ship.throttle = 1;
    this.events.push(`${label} BURN — ${Math.round(dv)} M/S ${HOLD_LABELS[mode]}`);
  }

  /** Per-frame guidance. Returns whether the engine must fire this frame. */
  update(sim: Simulation, frameDt: number): boolean {
    if (!this.hold && !this.burn) return false;
    // The maneuver planner owns the ship while it's aligning or burning.
    if (sim.planner.autoAlign || sim.planner.armed || sim.planner.burnActive) return false;

    const mode = this.burn ? this.burn.mode : this.hold!;
    this.stepHold(sim, mode, frameDt);

    if (!this.burn) return false;

    const delivered = sim.ship.stage.isp * G0 * Math.log(this.burn.massBefore / sim.ship.mass);
    const remaining = this.burn.totalDv - delivered;
    if (remaining <= 0.5 || sim.ship.fuel <= 0) {
      this.events.push(
        sim.ship.fuel <= 0
          ? `${this.burn.label} CUTOFF — PROPELLANT DEPLETED`
          : `${this.burn.label} COMPLETE — MISSION HOLD ${HOLD_LABELS[this.burn.mode]}`,
      );
      this.hold = this.burn.mode;
      this.burn = null;
      sim.ship.throttle = 1;
      return false;
    }
    // Feather the final moments so we don't overshoot the solved ΔV.
    const fullAccel = (sim.ship.stage.thrust / sim.ship.mass) * frameDt;
    sim.ship.throttle = Math.min(1, Math.max(0.05, remaining / Math.max(fullAccel, 1e-6)));
    return true;
  }

  private stepHold(sim: Simulation, mode: HoldMode, frameDt: number): void {
    const dir = this.frameVector(sim, mode);
    if (dir.lengthSq() < 1e-9) return;
    const target = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir.normalize());
    sim.ship.quaternion.slerp(target, 1 - Math.exp(-HOLD_RATE * frameDt));
    sim.ship.angularVelocity.set(0, 0, 0);
  }

  private frameVector(sim: Simulation, mode: HoldMode): Vector3 {
    const pos = sim.ship.position;
    const vel = sim.ship.velocity;
    const prograde = vel.clone().normalize();
    const normal = new Vector3().crossVectors(pos, vel).normalize();
    const radialOut = new Vector3().crossVectors(prograde, normal).normalize();
    switch (mode) {
      case 'prograde': return prograde;
      case 'retrograde': return prograde.negate();
      case 'radial-out': return radialOut;
      case 'radial-in': return radialOut.negate();
      case 'normal-plus': return normal;
      case 'normal-minus': return normal.negate();
    }
  }
}

/** Orbit guard: quick GO / caution label for the current orbit. */
export function orbitGuardLabel(sim: Simulation): { label: string; ok: boolean } {
  const el = sim.elements;
  if (el.eccentricity >= 1) return { label: 'ESCAPE', ok: false };
  const periAlt = el.periapsis - sim.primary.radius;
  const floor = sim.primary.hasAtmosphere ? 150_000 : 20_000;
  if (periAlt < floor) return { label: 'PE LOW', ok: false };
  return { label: 'GO', ok: true };
}
