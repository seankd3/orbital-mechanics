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

/**
 * Patched-conic, one-primary-at-a-time simulation (Apollo-build model):
 * ship state is stored RELATIVE to the current primary. The Moon flies a
 * kinematic circular ephemeris; crossing its SOI hands the ship over.
 */
export class Simulation {
  readonly ship = new Spacecraft();
  readonly planner = new ManeuverPlanner();
  readonly apollo = new ApolloOps();
  /** Mission elapsed time, seconds. */
  met = 0;
  warpIndex = 0;
  status: FlightStatus = 'flying';
  primary: Body = EARTH_BODY;
  elements: OrbitalElements;
  /** Set by the loop for one frame when something noteworthy happens. */
  events: string[] = [];
  /** When true, reaching Earth's surface counts as a splashdown, not a crash. */
  recoverable = false;

  private rails: RailsState | null = null;
  private wasInAtmosphere = false;

  constructor() {
    this.elements = elementsFromState(this.ship.position, this.ship.velocity);
    this.reset();
  }

  get warp(): number {
    return WARP_LEVELS[this.warpIndex];
  }

  get altitude(): number {
    return this.ship.position.length() - this.primary.radius;
  }

  /** Ship position in Earth-centered inertial space (render frame). */
  get absolutePosition(): Vector3 {
    return this.primary.positionAt(this.met).add(this.ship.position);
  }

  reset(): void {
    this.primary = EARTH_BODY;
    const r = EARTH.radius + START_ORBIT.altitude;
    const v = Math.sqrt(EARTH.mu / r);
    const inc = START_ORBIT.inclination;
    // Start over the equator heading into an inclined, prograde circular orbit.
    const position = new Vector3(r, 0, 0);
    const velocity = new Vector3(0, v * Math.sin(inc), -v * Math.cos(inc));
    this.ship.reset(position, velocity);
    this.planner.clear();
    this.apollo.clearGuidance(true);
    this.met = 0;
    this.warpIndex = 0;
    this.status = 'flying';
    this.recoverable = false;
    this.rails = null;
    this.wasInAtmosphere = false;
    this.elements = elementsFromState(position, velocity);
  }

  /** Teleport checkpoint: circular orbit around the given body (Apollo-style). */
  setCircularOrbit(body: Body, altitude: number, inclination = 0): void {
    this.primary = body;
    const r = body.radius + altitude;
    const v = Math.sqrt(body.mu / r);
    const position = new Vector3(r, 0, 0);
    const velocity = new Vector3(0, v * Math.sin(inclination), -v * Math.cos(inclination));
    this.ship.reset(position, velocity);
    this.planner.clear();
    this.apollo.clearGuidance(true);
    this.status = 'flying';
    this.rails = null;
    this.warpIndex = 0;
    this.elements = elementsFromState(position, velocity, body.mu);
    this.events.push(`CHECKPOINT — ${body.name} ORBIT ${Math.round(altitude / 1000)} KM`);
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

    const simDt = frameDt * this.warp;
    this.met += simDt;

    const assistSteering =
      this.planner.autoAlign || this.planner.burnActive || this.apollo.hold !== null || this.apollo.burn !== null;
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
    const { elements, meanAnomaly0, time0 } = this.rails;
    const M = meanAnomaly0 + meanMotion(elements) * (this.met - time0);
    const nu = meanToTrueAnomaly(M, elements.eccentricity);
    const vel = new Vector3();
    const pos = stateAtTrueAnomaly(elements, nu, vel);
    ship.position.copy(pos);
    ship.velocity.copy(vel);
  }

  /** Patched-conic handoff between Earth and the Moon. */
  private checkSoi(): void {
    const ship = this.ship;
    if (this.primary === EARTH_BODY) {
      const moonPos = MOON_BODY.positionAt(this.met);
      const rel = ship.position.clone().sub(moonPos);
      if (rel.length() < MOON.soiRadius) {
        ship.position.copy(rel);
        ship.velocity.sub(MOON_BODY.velocityAt(this.met));
        this.primary = MOON_BODY;
        this.handoff('ENTERING LUNAR SPHERE OF INFLUENCE');
      }
    } else if (ship.position.length() > MOON.soiRadius) {
      ship.position.add(MOON_BODY.positionAt(this.met));
      ship.velocity.add(MOON_BODY.velocityAt(this.met));
      this.primary = EARTH_BODY;
      this.handoff('LEAVING LUNAR SPHERE OF INFLUENCE');
    }
  }

  private handoff(message: string): void {
    this.rails = null;
    this.planner.clear();
    this.apollo.clearGuidance(true);
    if (this.warp > MAX_NUMERIC_WARP) this.setWarpIndex(3);
    this.elements = elementsFromState(this.ship.position, this.ship.velocity, this.primary.mu);
    this.events.push(message);
  }

  private checkSurface(): void {
    if (this.ship.position.length() > this.primary.radius) return;
    this.status = this.primary.hasAtmosphere && this.recoverable ? 'splashdown' : 'crashed';
    this.setWarpIndex(0);
    this.ship.firing = false;
    // Clamp to the surface so the wreck doesn't render underground.
    this.ship.position.setLength(this.primary.radius);
    this.ship.velocity.set(0, 0, 0);
  }
}
