import { Quaternion, Vector3 } from 'three';
import { EARTH, G0, MAX_POWERED_WARP } from '../constants';
import { BODIES, EARTH_BODY, MOON_BODY, spinRate, type Body } from './bodies';
import { crossSoi, nextEvent } from './coast';
import { Orbit } from './orbit';
import { aeroAccel, airDensity, rk4Step, type Aero } from './physics';
import {
  NO_ROTATION,
  NO_TRANSLATION,
  Spacecraft,
  type RotationInput,
  type TranslationInput,
} from './spacecraft';
import { CM_AERO, type VehicleId } from './vehicles';

export type Tone = 'info' | 'good' | 'warn' | 'bad';
export interface SimEvent {
  text: string;
  tone: Tone;
}

export interface Contact {
  body: Body['name'];
  /** Surface-relative sink rate (m/s, positive down) at contact. */
  verticalSpeed: number;
  horizontalSpeed: number;
  /** Angle between the craft's +Z and local vertical, degrees. */
  tilt: number;
}

export type Outcome = { kind: 'lost' | 'splashdown'; reason: string } | null;
export type Chutes = 'none' | 'drogue' | 'mains';

const LAND_MAX_SPEED = 5; // m/s surface-relative
const LAND_MAX_TILT = 30; // deg
const TRIM_PRESSURE = 50; // Pa — CM weathervanes heat-shield first above this
const Y = new Vector3(0, 1, 0);

/**
 * Patched-conic flight of the Apollo stack: CSM and LM as independent craft.
 * Coasting always rides the exact Kepler conic (so time warp never changes
 * the outcome); RK4 takes over only under thrust or in the air. The inactive
 * craft coasts on its own conic or rests on the rotating surface.
 */
export class Simulation {
  readonly csm = new Spacecraft('csm');
  readonly lm = new Spacecraft('lm');
  activeId: VehicleId = 'csm';
  docked = true;
  lmAlive = true;

  met = 0;
  warp = 1;
  /** When set, warp runs until exactly this MET, then drops to 1×. */
  warpUntil: number | null = null;
  primary: Body = EARTH_BODY;
  outcome: Outcome = null;
  chutes: Chutes = 'none';
  /** MET the current canopy started to inflate (reefed opening). */
  private chuteAt = 0;
  /** Non-gravitational acceleration, g. */
  gLoad = 0;
  peakG = 0;
  lastContact: Contact | null = null;

  /** Per-frame commands (set by the player or an autopilot). */
  rotation: RotationInput = NO_ROTATION;
  translation: TranslationInput = NO_TRANSLATION;
  /** Attitude-hold target; overrides the stick while set. */
  hold: Quaternion | null = null;

  events: SimEvent[] = [];
  private rails: Orbit | null = null;
  private otherRails: Orbit | null = null;
  private orbitCache: Orbit | null = null;

  get ship(): Spacecraft {
    return this.activeId === 'csm' ? this.csm : this.lm;
  }

  /** The separated partner craft, if any. */
  get other(): Spacecraft | null {
    if (this.docked || !this.lmAlive) return null;
    return this.activeId === 'csm' ? this.lm : this.csm;
  }

  /** Osculating conic of the active craft about the current primary. */
  get orbit(): Orbit {
    if (this.rails) return this.rails;
    if (!this.orbitCache || this.orbitCache.epoch !== this.met) {
      this.orbitCache = Orbit.fromState(this.ship.position, this.ship.velocity, this.primary.mu, this.met);
    }
    return this.orbitCache;
  }

  get altitude(): number {
    return this.ship.position.length() - this.primary.radius;
  }

  /** Current canopy's inflation, 0..1. */
  get chuteOpen(): number {
    return this.chutes === 'none' ? 0 : Math.min(1, (this.met - this.chuteAt) / CM_AERO.inflation);
  }

  get inAtmosphere(): boolean {
    // 1 m of hysteresis: a rails coast stops exactly *at* the interface.
    return this.primary.atmosphere > 0 && this.altitude < this.primary.atmosphere + 1;
  }

  /** Highest warp the current flight regime allows. */
  get maxWarp(): number {
    const s = this.ship;
    const powered = s.firing || s.rcsCommand.lengthSq() > 0 || (this.inAtmosphere && !s.landed);
    return powered ? MAX_POWERED_WARP : Infinity;
  }

  /** Position of a craft in Earth-centered inertial space. */
  absolutePosition(craft: Spacecraft = this.ship): Vector3 {
    return this.primary.positionAt(this.met).add(craft.position);
  }

  /** Relative state of the partner craft, seen from the active one. */
  relative(): { range: number; rangeRate: number; pos: Vector3; vel: Vector3 } | null {
    const other = this.other;
    if (!other) return null;
    const pos = other.position.clone().sub(this.ship.position);
    const vel = other.velocity.clone().sub(this.ship.velocity);
    const range = pos.length();
    return { range, rangeRate: range > 0 ? pos.dot(vel) / range : 0, pos, vel };
  }

  emit(text: string, tone: Tone = 'info'): void {
    this.events.push({ text, tone });
  }

  /** Invalidate cached conics after an outside change to craft state. */
  perturbed(): void {
    this.rails = null;
    this.otherRails = null;
    this.orbitCache = null;
  }

  // --- vehicle operations -------------------------------------------------

  undock(separation = 0.3): void {
    if (!this.docked || !this.lmAlive) return;
    const fwd = this.csm.forward;
    this.lm.position.copy(this.csm.position).addScaledVector(fwd, 12);
    this.lm.velocity.copy(this.csm.velocity).addScaledVector(fwd, separation);
    this.lm.quaternion.copy(this.csm.quaternion);
    this.lm.angularVelocity.set(0, 0, 0);
    this.csm.attachedMass = 0;
    this.docked = false;
    this.activeId = 'lm';
    this.perturbed();
  }

  /** Mate the two craft; after a rendezvous the spent LM is cast off. */
  dock(jettisonLm: boolean): void {
    if (this.docked || !this.lmAlive) return;
    // Momentum-conserving capture: the CSM keeps the pair's shared velocity.
    const m1 = this.csm.mass;
    const m2 = this.lm.mass;
    this.csm.velocity.multiplyScalar(m1).addScaledVector(this.lm.velocity, m2).divideScalar(m1 + m2);
    this.lm.position.copy(this.csm.position);
    this.lm.velocity.copy(this.csm.velocity);
    this.docked = true;
    this.activeId = 'csm';
    this.lmAlive = !jettisonLm;
    this.csm.attachedMass = jettisonLm ? 0 : this.lm.ownMass;
    this.perturbed();
  }

  // --- stepping ----------------------------------------------------------

  step(realDt: number): void {
    if (this.outcome) return;
    const ship = this.ship;
    this.warp = Math.min(this.warp, this.maxWarp);
    let simDt = realDt * this.warp;
    if (this.warpUntil !== null) simDt = Math.min(simDt, Math.max(0, this.warpUntil - this.met));

    this.stepAttitude(ship, realDt, simDt);
    ship.rcsCommand.set(this.translation.x, this.translation.y, this.translation.z);
    this.anchorOther(); // before MET moves: the partner's conic is anchored at "now"

    if (ship.landedSite) {
      this.met += simDt;
      this.stepLanded(ship);
    } else if (ship.firing || ship.rcsCommand.lengthSq() > 0 || this.inAtmosphere) {
      this.stepNumeric(simDt);
    } else {
      this.stepRails(simDt);
    }
    this.propagateOther();

    if (this.warpUntil !== null && this.met >= this.warpUntil - 1e-6) {
      this.warpUntil = null;
      this.warp = 1;
    }
  }

  private stepAttitude(ship: Spacecraft, realDt: number, simDt: number): void {
    const aeroTrim = this.aeroTrimActive(ship);
    if (this.hold && !aeroTrim) {
      ship.slewToward(this.hold, realDt * Math.min(this.warp, MAX_POWERED_WARP));
    } else if (this.warp <= MAX_POWERED_WARP) {
      ship.applyRotationInput(this.rotation, simDt);
      ship.integrateAttitude(simDt);
    }
    if (aeroTrim) this.trimHeatShield(ship);
  }

  private stepLanded(ship: Spacecraft): void {
    const body = this.primary;
    ship.position.copy(ship.landedSite!).applyAxisAngle(Y, body.spinAt(this.met)).multiplyScalar(body.radius);
    ship.velocity.crossVectors(Y, ship.position).multiplyScalar(spinRate(body));
    this.rails = null;
    if (!ship.firing) return;
    const weight = (body.mu / ship.position.lengthSq()) * ship.mass;
    if (ship.stage.thrust * ship.throttle > weight) {
      ship.landedSite = null;
      ship.position.addScaledVector(ship.position.clone().normalize(), 0.5);
      this.emit('LIFTOFF', 'good');
    }
  }

  private stepRails(simDt: number): void {
    const ship = this.ship;
    const tEnd = this.met + simDt;
    while (this.met < tEnd && !this.outcome) {
      this.rails ??= Orbit.fromState(ship.position, ship.velocity, this.primary.mu, this.met);
      const ev = nextEvent(this.rails, this.primary, this.met, tEnd);
      const t = ev ? ev.t : tEnd;
      this.rails.stateAt(t, ship.position, ship.velocity);
      this.met = t;
      if (!ev) break;
      if (ev.kind === 'soi-enter' || ev.kind === 'soi-exit') {
        this.changePrimary(ev.kind);
      } else {
        this.rails = null; // atmosphere or surface: hand over to RK4 next frame
        if (ev.kind === 'surface') this.contact();
        break;
      }
    }
  }

  private stepNumeric(simDt: number): void {
    const ship = this.ship;
    this.rails = null;
    const inAir = this.primary.atmosphere > 0;
    const maxStep = inAir ? 0.25 : 0.5;
    const steps = Math.max(1, Math.ceil(simDt / maxStep));
    const h = simDt / steps;
    for (let i = 0; i < steps && !this.outcome; i++) {
      this.updateChutes(ship);
      const engine = ship.thrustAccel;
      const push = engine.clone().add(ship.rcsAccel);
      const aero = inAir ? this.aero(ship) : null;
      const mass = ship.mass;
      const extra = aero ? (p: Vector3, v: Vector3) => aeroAccel(p, v, mass, aero).add(push) : () => push;
      if (aero) {
        const a = aeroAccel(ship.position, ship.velocity, mass, aero).add(push);
        this.gLoad = a.length() / G0;
        if (this.inAtmosphere) this.peakG = Math.max(this.peakG, this.gLoad);
      } else {
        this.gLoad = push.length() / G0;
      }
      rk4Step(ship.position, ship.velocity, h, extra, this.primary.mu);
      ship.burnDv.addScaledVector(engine, h);
      ship.consume(h);
      this.met += h;
      if (ship.position.length() <= this.primary.radius) {
        this.contact();
        break;
      }
      this.checkSoiNumeric();
    }
  }

  private checkSoiNumeric(): void {
    const pos = this.ship.position;
    if (this.primary === EARTH_BODY) {
      if (pos.distanceTo(MOON_BODY.positionAt(this.met)) < MOON_BODY.soi) this.changePrimary('soi-enter');
    } else if (pos.length() > this.primary.soi) {
      this.changePrimary('soi-exit');
    }
  }

  private changePrimary(kind: 'soi-enter' | 'soi-exit'): void {
    const ship = this.ship;
    this.propagateOther(); // bring the partner to the crossing instant first
    this.primary = crossSoi(kind, ship.position, ship.velocity, this.met);
    const other = this.other;
    if (other && !other.landedSite) {
      crossSoi(kind, other.position, other.velocity, this.met);
    } else if (other) {
      this.lmAlive = false;
      this.emit('LM LEFT BEHIND', 'warn');
    }
    this.perturbed();
    this.emit(kind === 'soi-enter' ? 'ENTERING LUNAR SPHERE OF INFLUENCE' : 'LEAVING LUNAR SPHERE OF INFLUENCE');
  }

  private anchorOther(): void {
    const other = this.other;
    if (other && !other.landedSite && !this.otherRails) {
      this.otherRails = Orbit.fromState(other.position, other.velocity, this.primary.mu, this.met);
    }
  }

  private propagateOther(): void {
    const other = this.other;
    if (!other) return;
    if (other.landedSite) {
      const body = this.primary;
      other.position.copy(other.landedSite).applyAxisAngle(Y, body.spinAt(this.met)).multiplyScalar(body.radius);
      other.velocity.crossVectors(Y, other.position).multiplyScalar(spinRate(body));
      return;
    }
    this.anchorOther();
    this.otherRails!.stateAt(this.met, other.position, other.velocity);
  }

  // --- surfaces & air ----------------------------------------------------

  private aero(ship: Spacecraft): Aero {
    const isCm = ship.id === 'csm' && ship.stage.name === 'CM';
    if (!isCm) return { cdA: 25, liftToDrag: 0 };
    if (this.chutes === 'none') {
      return { cdA: CM_AERO.cdA, liftToDrag: CM_AERO.liftToDrag, liftDir: this.liftDirection(ship) };
    }
    // Reefed canopies open progressively instead of snapping to full area.
    const [from, to] = this.chutes === 'drogue' ? [CM_AERO.cdA, CM_AERO.drogue.cdA] : [CM_AERO.drogue.cdA, CM_AERO.mains.cdA];
    const open = this.chuteOpen;
    return { cdA: from + (to - from) * open * open, liftToDrag: 0 };
  }

  /** CM lift vector: body +Y, perpendicular to the airflow. */
  liftDirection(ship: Spacecraft = this.ship): Vector3 {
    const v = ship.velocity.clone().normalize();
    const y = ship.axis(0, 1, 0);
    return y.addScaledVector(v, -y.dot(v)).normalize();
  }

  private aeroTrimActive(ship: Spacecraft): boolean {
    if (ship.id !== 'csm' || ship.stage.name !== 'CM' || this.primary.atmosphere === 0) return false;
    const q = 0.5 * airDensity(this.altitude) * ship.velocity.lengthSq();
    return q > TRIM_PRESSURE;
  }

  /** The CM weathervanes heat shield first; only roll (bank) stays free. */
  private trimHeatShield(ship: Spacecraft): void {
    const aft = ship.velocity.clone().normalize().negate();
    const turn = new Quaternion().setFromUnitVectors(ship.forward, aft);
    ship.quaternion.premultiply(turn).normalize();
    ship.angularVelocity.x = ship.angularVelocity.y = 0;
  }

  private updateChutes(ship: Spacecraft): void {
    if (ship.id !== 'csm' || ship.stage.name !== 'CM' || this.primary !== EARTH_BODY) return;
    const alt = this.altitude;
    if (this.chutes === 'none' && alt < CM_AERO.drogue.altitude && ship.velocity.length() < CM_AERO.drogue.maxSpeed) {
      this.chutes = 'drogue';
      this.chuteAt = this.met;
      this.emit('DROGUES', 'good');
    } else if (this.chutes === 'drogue' && alt < CM_AERO.mains.altitude) {
      this.chutes = 'mains';
      this.chuteAt = this.met;
      this.emit('MAIN CHUTES — THREE GOOD CHUTES', 'good');
    }
  }

  private contact(): void {
    const ship = this.ship;
    const body = this.primary;
    const up = ship.position.clone().normalize();
    const surfaceVel = new Vector3().crossVectors(Y, ship.position).multiplyScalar(spinRate(body));
    const rel = ship.velocity.clone().sub(surfaceVel);
    const vertical = -rel.dot(up);
    const horizontal = rel.addScaledVector(up, vertical).length();
    const tilt = (ship.forward.angleTo(up) * 180) / Math.PI;
    this.lastContact = { body: body.name, verticalSpeed: vertical, horizontalSpeed: horizontal, tilt };
    ship.throttle = 0;
    this.warp = 1;
    this.warpUntil = null;
    this.perturbed();

    if (body === EARTH_BODY) {
      const safe = this.chutes === 'mains' && vertical < 15;
      this.outcome = safe
        ? { kind: 'splashdown', reason: 'SPLASHDOWN' }
        : { kind: 'lost', reason: `IMPACT AT ${Math.round(ship.velocity.length())} M/S` };
      ship.position.setLength(EARTH.radius);
      ship.velocity.set(0, 0, 0);
      return;
    }
    const speed = Math.hypot(vertical, horizontal);
    if (speed > LAND_MAX_SPEED || tilt > LAND_MAX_TILT) {
      this.outcome = {
        kind: 'lost',
        reason: speed > LAND_MAX_SPEED ? `IMPACT AT ${speed.toFixed(1)} M/S` : `TIPPED OVER — ${Math.round(tilt)}° TILT`,
      };
      ship.position.setLength(body.radius);
      ship.velocity.copy(surfaceVel);
      return;
    }
    ship.landedSite = up.applyAxisAngle(Y, -body.spinAt(this.met));
    ship.pointAlong(ship.position);
    this.stepLanded(ship);
    this.emit('CONTACT LIGHT', 'good');
  }

  // --- snapshots ---------------------------------------------------------

  snapshot(): Snapshot {
    const craft = (c: Spacecraft): CraftSnapshot => ({
      pos: c.position.toArray(),
      vel: c.velocity.toArray(),
      quat: c.quaternion.toArray() as number[],
      fuels: [...c.fuels],
      stagesDropped: c.stagesDropped,
      rcsFuel: c.rcsFuel,
      attachedMass: c.attachedMass,
      landedSite: c.landedSite?.toArray() ?? null,
    });
    return {
      met: this.met,
      primary: this.primary.name,
      activeId: this.activeId,
      docked: this.docked,
      lmAlive: this.lmAlive,
      chutes: this.chutes,
      csm: craft(this.csm),
      lm: craft(this.lm),
    };
  }

  restore(s: Snapshot): void {
    const craft = (c: Spacecraft, d: CraftSnapshot) => {
      c.position.fromArray(d.pos);
      c.velocity.fromArray(d.vel);
      c.quaternion.fromArray(d.quat);
      c.angularVelocity.set(0, 0, 0);
      c.fuels = [...d.fuels];
      c.stagesDropped = d.stagesDropped;
      c.rcsFuel = d.rcsFuel;
      c.attachedMass = d.attachedMass;
      c.landedSite = d.landedSite ? new Vector3().fromArray(d.landedSite) : null;
      c.throttle = 0;
      c.sas = true;
      c.rcsCommand.set(0, 0, 0);
      c.burnDv.set(0, 0, 0);
    };
    this.met = s.met;
    this.primary = BODIES[s.primary];
    this.activeId = s.activeId;
    this.docked = s.docked;
    this.lmAlive = s.lmAlive;
    this.chutes = s.chutes;
    craft(this.csm, s.csm);
    craft(this.lm, s.lm);
    this.outcome = null;
    this.warp = 1;
    this.warpUntil = null;
    this.gLoad = this.peakG = 0;
    this.lastContact = null;
    this.hold = null;
    this.rotation = NO_ROTATION;
    this.translation = NO_TRANSLATION;
    this.events = [];
    this.perturbed();
  }
}

export interface CraftSnapshot {
  pos: number[];
  vel: number[];
  quat: number[];
  fuels: number[];
  stagesDropped: number;
  rcsFuel: number;
  attachedMass: number;
  landedSite: number[] | null;
}

export interface Snapshot {
  met: number;
  primary: Body['name'];
  activeId: VehicleId;
  docked: boolean;
  lmAlive: boolean;
  chutes: Chutes;
  csm: CraftSnapshot;
  lm: CraftSnapshot;
}
