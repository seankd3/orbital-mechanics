import { Vector3 } from 'three';
import { ATMOSPHERE, EARTH, MAX_NUMERIC_WARP, MAX_PHYSICS_WARP, START_ORBIT, WARP_LEVELS } from '../constants';
import { Spacecraft, type RotationInput } from './spacecraft';
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

export class Simulation {
  readonly ship = new Spacecraft();
  /** Mission elapsed time, seconds. */
  met = 0;
  warpIndex = 0;
  status: FlightStatus = 'flying';
  elements: OrbitalElements;
  /** Set by the loop for one frame when something noteworthy happens. */
  events: string[] = [];
  /** When true, reaching the surface counts as a splashdown, not a crash. */
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
    return this.ship.position.length() - EARTH.radius;
  }

  reset(): void {
    const r = EARTH.radius + START_ORBIT.altitude;
    const v = Math.sqrt(EARTH.mu / r);
    const inc = START_ORBIT.inclination;
    // Start over the equator heading into an inclined, prograde circular orbit.
    const position = new Vector3(r, 0, 0);
    const velocity = new Vector3(0, v * Math.sin(inc), -v * Math.cos(inc));
    this.ship.reset(position, velocity);
    this.met = 0;
    this.warpIndex = 0;
    this.status = 'flying';
    this.recoverable = false;
    this.rails = null;
    this.wasInAtmosphere = false;
    this.elements = elementsFromState(position, velocity);
  }

  setWarpIndex(i: number): void {
    this.warpIndex = Math.max(0, Math.min(WARP_LEVELS.length - 1, i));
    if (this.warp <= MAX_NUMERIC_WARP) this.rails = null;
  }

  step(frameDt: number, rotation: RotationInput, wantsBurn: boolean): void {
    this.events = [];
    if (this.status !== 'flying') return;

    const ship = this.ship;

    // Burning or steering above physics warp auto-drops to 1×, like the classics.
    const controlsActive =
      wantsBurn || rotation.pitch !== 0 || rotation.yaw !== 0 || rotation.roll !== 0;
    if (controlsActive && this.warp > MAX_PHYSICS_WARP) {
      this.setWarpIndex(0);
      this.events.push('WARP CANCELLED — MANUAL CONTROL');
    }

    const wasFiring = ship.firing;
    ship.firing = wantsBurn && ship.fuel > 0;
    if (ship.firing && !wasFiring && ship.throttle === 0) {
      this.events.push('THROTTLE AT ZERO');
    }
    if (wasFiring && ship.fuel <= 0 && wantsBurn) {
      this.events.push('FUEL DEPLETED');
    }

    const simDt = frameDt * this.warp;
    this.met += simDt;

    if (this.warp <= MAX_PHYSICS_WARP) {
      ship.applyRotationInput(rotation, frameDt);
      ship.updateAttitude(frameDt);
    }

    // Rails are drag-free Kepler arcs: only valid clear of the atmosphere.
    const railsOk =
      this.warp > MAX_NUMERIC_WARP &&
      this.elements.eccentricity < 1 &&
      this.elements.periapsis - EARTH.radius > ATMOSPHERE.ceiling;
    if (railsOk) {
      this.stepOnRails(simDt);
    } else {
      this.rails = null;
      this.stepNumeric(simDt);
    }

    this.elements = elementsFromState(ship.position, ship.velocity);

    const inAtmosphere = this.altitude < ATMOSPHERE.ceiling;
    if (inAtmosphere && !this.wasInAtmosphere) {
      this.events.push('ATMOSPHERIC INTERFACE');
      if (this.warp > MAX_PHYSICS_WARP) this.setWarpIndex(0);
    }
    this.wasInAtmosphere = inAtmosphere;

    this.checkSurface();
  }

  private stepNumeric(simDt: number): void {
    const ship = this.ship;
    // Sub-step so RK4 stays accurate: ≤ 2 s per step in LEO scales fine.
    const steps = Math.min(512, Math.max(1, Math.ceil(simDt / 2)));
    const dt = simDt / steps;
    for (let i = 0; i < steps; i++) {
      const thrust = ship.thrustAccel;
      rk4Step(ship.position, ship.velocity, dt, (p, v) =>
        dragAccel(p, v, ship.mass).add(thrust),
      );
      ship.consumeFuel(dt);
      if (ship.position.length() <= EARTH.radius) break;
    }
  }

  private stepOnRails(simDt: number): void {
    const ship = this.ship;
    if (!this.rails) {
      const elements = elementsFromState(ship.position, ship.velocity);
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

  private checkSurface(): void {
    if (this.ship.position.length() > EARTH.radius) return;
    this.status = this.recoverable ? 'splashdown' : 'crashed';
    this.setWarpIndex(0);
    this.ship.firing = false;
    // Clamp to the surface so the wreck doesn't render underground.
    this.ship.position.setLength(EARTH.radius);
    this.ship.velocity.set(0, 0, 0);
  }
}
