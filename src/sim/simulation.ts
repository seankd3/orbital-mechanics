import { Vector3 } from 'three';
import {
  ATMOSPHERE,
  EARTH,
  MAX_NUMERIC_WARP,
  MAX_PHYSICS_WARP,
  MOON,
  START_ORBIT,
  WARP_LEVELS,
} from '../constants';
import { ApolloOps } from './apollo';
import { EARTH_BODY, MOON_BODY, type Body } from './bodies';
import { ManeuverPlanner } from './maneuver';
import { Spacecraft, type RotationInput, type TranslationInput } from './spacecraft';
import type { VehicleId } from './vehicles';
import {
  dragAccel,
  elementsFromState,
  meanMotion,
  meanToTrueAnomaly,
  rk4Step,
  stateAtTrueAnomaly,
  trueToMeanAnomaly,
  type OrbitalElements,
} from './physics';

export type FlightStatus = 'flying' | 'crashed' | 'splashdown';

interface RailsState {
  elements: OrbitalElements;
  meanAnomaly0: number;
  time0: number;
}

const DOCK_RANGE = 300; // m
const DOCK_MAX_RELVEL = 3; // m/s
const TOUCHDOWN_SPEED = 8; // m/s — gentler than this on an airless body = landed

/**
 * Patched-conic, one-primary-at-a-time simulation flying a full Apollo
 * stack: CSM and LM as independent craft. The active craft integrates
 * numerically; the inactive one coasts on Kepler rails (or sits landed).
 */
export class Simulation {
  readonly csm = new Spacecraft('csm');
  readonly lm = new Spacecraft('lm');
  readonly planner = new ManeuverPlanner();
  readonly apollo = new ApolloOps();

  activeId: VehicleId = 'csm';
  /** CSM and LM mated — the stack flies as one on the CSM's engine. */
  docked = true;
  /** LM exists (false after post-rendezvous jettison or abandonment). */
  lmAlive = true;

  /** Mission elapsed time, seconds. */
  met = 0;
  warpIndex = 0;
  status: FlightStatus = 'flying';
  primary: Body = EARTH_BODY;
  elements: OrbitalElements;
  events: string[] = [];
  /** When true, reaching Earth's surface counts as a splashdown, not a crash. */
  recoverable = false;

  private rails: RailsState | null = null;
  private inactiveRails: RailsState | null = null;
  private wasInAtmosphere = false;

  constructor() {
    this.elements = elementsFromState(this.csm.position, this.csm.velocity);
    this.reset();
  }

  /** The craft under manual control. */
  get ship(): Spacecraft {
    return this.activeId === 'csm' ? this.csm : this.lm;
  }

  /** The other craft, when it's flying free. */
  get inactive(): Spacecraft | null {
    if (this.docked || !this.lmAlive) return null;
    return this.activeId === 'csm' ? this.lm : this.csm;
  }

  get warp(): number {
    return WARP_LEVELS[this.warpIndex];
  }

  get altitude(): number {
    return this.ship.position.length() - this.primary.radius;
  }

  /** Active-craft position in Earth-centered inertial space (render frame). */
  get absolutePosition(): Vector3 {
    return this.primary.positionAt(this.met).add(this.ship.position);
  }

  /** Distance / closing info to the other craft, when separated. */
  get target(): { distance: number; relVel: number } | null {
    const other = this.inactive;
    if (!other || other.landed) {
      if (other?.landed) {
        return { distance: this.ship.position.distanceTo(other.position), relVel: NaN };
      }
      return null;
    }
    return {
      distance: this.ship.position.distanceTo(other.position),
      relVel: this.ship.velocity.distanceTo(other.velocity),
    };
  }

  reset(): void {
    this.primary = EARTH_BODY;
    const r = EARTH.radius + START_ORBIT.altitude;
    const v = Math.sqrt(EARTH.mu / r);
    const inc = START_ORBIT.inclination;
    const position = new Vector3(r, 0, 0);
    const velocity = new Vector3(0, v * Math.sin(inc), -v * Math.cos(inc));
    this.csm.reset(position, velocity);
    this.lm.reset(position, velocity);
    this.mateStack();
    this.planner.clear();
    this.apollo.clearGuidance(true);
    this.met = 0;
    this.warpIndex = 0;
    this.status = 'flying';
    this.recoverable = false;
    this.rails = null;
    this.inactiveRails = null;
    this.wasInAtmosphere = false;
    this.elements = elementsFromState(position, velocity);
  }

  /** Teleport checkpoint: full docked stack in a circular orbit. */
  setCircularOrbit(body: Body, altitude: number, inclination = 0): void {
    this.primary = body;
    const r = body.radius + altitude;
    const v = Math.sqrt(body.mu / r);
    const position = new Vector3(r, 0, 0);
    const velocity = new Vector3(0, v * Math.sin(inclination), -v * Math.cos(inclination));
    this.csm.reset(position, velocity);
    this.lm.reset(position, velocity);
    this.mateStack();
    this.planner.clear();
    this.apollo.clearGuidance(true);
    this.status = 'flying';
    this.rails = null;
    this.inactiveRails = null;
    this.warpIndex = 0;
    this.elements = elementsFromState(position, velocity, body.mu);
    this.events.push(`CHECKPOINT — ${body.name} ORBIT ${Math.round(altitude / 1000)} KM`);
  }

  private mateStack(): void {
    this.activeId = 'csm';
    this.docked = true;
    this.lmAlive = true;
    this.csm.attachedMass = this.lm.ownMass;
  }

  /** Crew into the LM, springs push it clear. The LM becomes active. */
  undock(): void {
    if (!this.docked || !this.lmAlive || this.status !== 'flying') return;
    const fwd = this.csm.forward;
    this.lm.position.copy(this.csm.position).addScaledVector(fwd, 30);
    this.lm.velocity.copy(this.csm.velocity).addScaledVector(fwd, 0.4);
    this.lm.quaternion.copy(this.csm.quaternion);
    this.lm.angularVelocity.set(0, 0, 0);
    this.csm.attachedMass = 0;
    this.docked = false;
    this.activeId = 'lm';
    this.onActiveChanged();
    this.cacheInactiveRails();
    this.events.push('LM UNDOCKED — YOU ARE THE EAGLE');
  }

  /** Hard-dock when close and slow. Ascent-stage returns get jettisoned. */
  dock(): void {
    if (this.docked || !this.lmAlive || this.status !== 'flying') return;
    const t = this.target;
    if (!t || isNaN(t.relVel)) return;
    if (t.distance > DOCK_RANGE || t.relVel > DOCK_MAX_RELVEL) {
      this.events.push(
        `DOCKING ABORT — NEED <${DOCK_RANGE} M AND <${DOCK_MAX_RELVEL} M/S (${Math.round(t.distance)} M, ${t.relVel.toFixed(1)} M/S)`,
      );
      return;
    }
    // The CSM is the living room: control returns there.
    this.activeId = 'csm';
    this.docked = true;
    if (this.lm.stagesDropped > 0) {
      // Post-rendezvous: crew transfers, spent ascent stage is cut loose.
      this.lmAlive = false;
      this.csm.attachedMass = 0;
      this.events.push('HARD DOCK — CREW TRANSFERRED, LM JETTISONED');
    } else {
      this.csm.attachedMass = this.lm.ownMass;
      this.events.push('HARD DOCK — STACK MATED');
    }
    this.inactiveRails = null;
    this.onActiveChanged();
  }

  /** Swap control between separated craft. */
  switchCraft(): void {
    const other = this.inactive;
    if (!other || this.status !== 'flying') return;
    this.cacheActiveIntoInactiveRailsAndSwap();
    this.events.push(`CONTROL — ${this.ship.spec.label}`);
  }

  private cacheActiveIntoInactiveRailsAndSwap(): void {
    this.activeId = this.activeId === 'csm' ? 'lm' : 'csm';
    this.onActiveChanged();
    this.cacheInactiveRails();
  }

  private onActiveChanged(): void {
    this.planner.clear();
    this.apollo.clearGuidance(true);
    this.rails = null;
    this.setWarpIndex(Math.min(this.warpIndex, 3));
    this.elements = elementsFromState(this.ship.position, this.ship.velocity, this.primary.mu);
  }

  private cacheInactiveRails(): void {
    const other = this.inactive;
    this.inactiveRails = null;
    if (!other || other.landed) return;
    const elements = elementsFromState(other.position, other.velocity, this.primary.mu);
    this.inactiveRails = {
      elements,
      meanAnomaly0: trueToMeanAnomaly(elements.trueAnomaly, elements.eccentricity),
      time0: this.met,
    };
  }

  setWarpIndex(i: number): void {
    this.warpIndex = Math.max(0, Math.min(WARP_LEVELS.length - 1, i));
    if (this.warp <= MAX_NUMERIC_WARP) this.rails = null;
  }

  step(
    frameDt: number,
    rotation: RotationInput,
    wantsBurn: boolean,
    translation: TranslationInput = { x: 0, y: 0, z: 0 },
  ): void {
    this.events = [];
    if (this.status !== 'flying') return;

    const ship = this.ship;
    const simDt = frameDt * this.warp;

    // Sitting on the surface: hold until the engine overcomes local gravity.
    if (ship.landed) {
      this.met += simDt;
      this.propagateInactive();
      if (wantsBurn && ship.fuel > 0) {
        const weight = (this.primary.mu / ship.position.lengthSq()) * ship.mass;
        if (ship.stage.thrust * ship.throttle > weight) {
          ship.landed = false;
          ship.velocity.copy(ship.position.clone().normalize().multiplyScalar(3));
          this.events.push('LIFTOFF');
        } else {
          this.events.push('TWR < 1 — THROTTLE UP');
        }
      }
      return;
    }

    // Burning or steering above physics warp auto-drops to 1×, like the classics.
    const controlsActive =
      wantsBurn ||
      rotation.pitch !== 0 || rotation.yaw !== 0 || rotation.roll !== 0 ||
      translation.x !== 0 || translation.y !== 0 || translation.z !== 0;
    if (controlsActive && this.warp > MAX_PHYSICS_WARP) {
      this.setWarpIndex(0);
      this.events.push('WARP CANCELLED — MANUAL CONTROL');
    }
    // Manual input takes the stick back from any assist.
    if (wantsBurn && (this.planner.armed || this.planner.burnActive)) {
      this.planner.clear();
      this.events.push('NODE CANCELLED — MANUAL BURN');
    }
    if (rotation.pitch !== 0 || rotation.yaw !== 0 || rotation.roll !== 0) {
      this.apollo.clearGuidance();
    }

    // Assists: may auto-align the ship and command the engine.
    const plannerFires = this.planner.update(this, frameDt);
    const apolloFires = this.apollo.update(this, frameDt);
    this.events.push(...this.planner.events, ...this.apollo.events);
    this.planner.events = [];
    this.apollo.events = [];

    const wasFiring = ship.firing;
    ship.firing = (wantsBurn || plannerFires || apolloFires) && ship.fuel > 0;
    if (wasFiring && ship.fuel <= 0 && wantsBurn) {
      this.events.push('FUEL DEPLETED');
    }

    ship.rcsCommand.set(translation.x, translation.y, translation.z);

    this.met += simDt;

    const assistSteering =
      this.planner.autoAlign || this.planner.burnActive ||
      this.apollo.hold !== null || this.apollo.burn !== null;
    if (this.warp <= MAX_PHYSICS_WARP && !assistSteering) {
      ship.applyRotationInput(rotation, frameDt);
      ship.updateAttitude(frameDt);
    }

    // Rails are drag-free Kepler arcs: only valid clear of the atmosphere.
    const railsOk =
      this.warp > MAX_NUMERIC_WARP &&
      this.elements.eccentricity < 1 &&
      (!this.primary.hasAtmosphere ||
        this.elements.periapsis - this.primary.radius > ATMOSPHERE.ceiling);
    if (railsOk) {
      this.stepOnRails();
    } else {
      this.rails = null;
      this.stepNumeric(simDt);
    }

    this.propagateInactive();
    this.elements = elementsFromState(ship.position, ship.velocity, this.primary.mu);

    this.checkSoi();

    if (this.primary.hasAtmosphere) {
      const inAtmosphere = this.altitude < ATMOSPHERE.ceiling;
      if (inAtmosphere && !this.wasInAtmosphere) {
        this.events.push('ATMOSPHERIC INTERFACE');
        if (this.warp > MAX_PHYSICS_WARP) this.setWarpIndex(0);
      }
      this.wasInAtmosphere = inAtmosphere;
    }

    this.checkSurface();
  }

  private stepNumeric(simDt: number): void {
    const ship = this.ship;
    // Sub-step so RK4 stays accurate: ≤ 2 s per step in LEO scales fine.
    const steps = Math.min(512, Math.max(1, Math.ceil(simDt / 2)));
    const dt = simDt / steps;
    const inAtmosphere = this.primary.hasAtmosphere;
    for (let i = 0; i < steps; i++) {
      const thrust = ship.thrustAccel.add(ship.rcsAccel);
      rk4Step(
        ship.position,
        ship.velocity,
        dt,
        inAtmosphere ? (p, v) => dragAccel(p, v, ship.mass).add(thrust) : () => thrust,
        this.primary.mu,
      );
      ship.consumeFuel(dt);
      ship.consumeRcsFuel(dt);
      if (ship.position.length() <= this.primary.radius) break;
    }
  }

  private stepOnRails(): void {
    const ship = this.ship;
    if (!this.rails) {
      const elements = elementsFromState(ship.position, ship.velocity, this.primary.mu);
      this.rails = {
        elements,
        meanAnomaly0: trueToMeanAnomaly(elements.trueAnomaly, elements.eccentricity),
        time0: this.met,
      };
    }
    setRailsState(this.rails, this.met, ship.position, ship.velocity);
  }

  private propagateInactive(): void {
    const other = this.inactive;
    if (!other || other.landed) return;
    if (!this.inactiveRails) this.cacheInactiveRails();
    if (this.inactiveRails) {
      setRailsState(this.inactiveRails, this.met, other.position, other.velocity);
    }
  }

  /** Patched-conic handoff between Earth and the Moon. */
  private checkSoi(): void {
    const ship = this.ship;
    if (this.primary === EARTH_BODY) {
      const moonPos = MOON_BODY.positionAt(this.met);
      const rel = ship.position.clone().sub(moonPos);
      if (rel.length() < MOON.soiRadius) {
        this.convertFrames(moonPos, MOON_BODY.velocityAt(this.met), -1);
        this.primary = MOON_BODY;
        this.handoff('ENTERING LUNAR SPHERE OF INFLUENCE');
      }
    } else if (ship.position.length() > MOON.soiRadius) {
      this.convertFrames(MOON_BODY.positionAt(this.met), MOON_BODY.velocityAt(this.met), 1);
      this.primary = EARTH_BODY;
      this.handoff('LEAVING LUNAR SPHERE OF INFLUENCE');
    }
  }

  /** Shift both free-flying craft into the new primary's frame. */
  private convertFrames(bodyPos: Vector3, bodyVel: Vector3, sign: 1 | -1): void {
    const shift = (craft: Spacecraft) => {
      craft.position.addScaledVector(bodyPos, sign);
      craft.velocity.addScaledVector(bodyVel, sign);
    };
    shift(this.ship);
    const other = this.inactive;
    if (other && !other.landed) {
      shift(other);
    } else if (other?.landed) {
      // A landed LM can't come along to another primary — it stays behind.
      this.lmAlive = false;
      this.events.push('LM LEFT BEHIND — OUT OF RANGE');
    }
  }

  private handoff(message: string): void {
    this.rails = null;
    this.inactiveRails = null;
    this.planner.clear();
    this.apollo.clearGuidance(true);
    if (this.warp > MAX_NUMERIC_WARP) this.setWarpIndex(3);
    this.elements = elementsFromState(this.ship.position, this.ship.velocity, this.primary.mu);
    this.events.push(message);
  }

  private checkSurface(): void {
    const ship = this.ship;
    if (ship.position.length() > this.primary.radius) return;

    const speed = ship.velocity.length();
    if (!this.primary.hasAtmosphere && speed < TOUCHDOWN_SPEED) {
      // Gentle contact on an airless body: touchdown.
      ship.landed = true;
      ship.firing = false;
      ship.position.setLength(this.primary.radius);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), ship.position.clone().normalize());
      this.setWarpIndex(0);
      this.planner.clear();
      this.apollo.clearGuidance(true);
      this.events.push(
        ship.id === 'lm' ? 'CONTACT LIGHT — THE EAGLE HAS LANDED' : 'TOUCHDOWN',
      );
      return;
    }

    this.status = this.primary.hasAtmosphere && this.recoverable ? 'splashdown' : 'crashed';
    this.setWarpIndex(0);
    ship.firing = false;
    ship.position.setLength(this.primary.radius);
    ship.velocity.set(0, 0, 0);
  }
}

function setRailsState(rails: RailsState, met: number, outPos: Vector3, outVel: Vector3): void {
  const M = rails.meanAnomaly0 + meanMotion(rails.elements) * (met - rails.time0);
  const nu = meanToTrueAnomaly(M, rails.elements.eccentricity);
  const vel = new Vector3();
  const pos = stateAtTrueAnomaly(rails.elements, nu, vel);
  outPos.copy(pos);
  outVel.copy(vel);
}
