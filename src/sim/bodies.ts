import { Vector3 } from 'three';
import { ATMOSPHERE, EARTH, MOON } from '../constants';

export interface Body {
  name: 'EARTH' | 'MOON';
  mu: number;
  radius: number;
  /** Altitude below which drag applies (0 for airless bodies). */
  atmosphere: number;
  /** Radius beyond which the craft leaves this body's sphere of influence. */
  soi: number;
  /** Position in Earth-centered inertial space at mission time t (s). */
  positionAt(t: number): Vector3;
  velocityAt(t: number): Vector3;
  /** Rotation about +Y at time t (rad) — body-fixed → inertial. */
  spinAt(t: number): number;
}

const MOON_RATE = (2 * Math.PI) / MOON.orbitPeriod;

export const EARTH_BODY: Body = {
  name: 'EARTH',
  mu: EARTH.mu,
  radius: EARTH.radius,
  atmosphere: ATMOSPHERE.ceiling,
  soi: Infinity,
  positionAt: () => new Vector3(),
  velocityAt: () => new Vector3(),
  spinAt: (t) => (2 * Math.PI * t) / EARTH.siderealDay,
};

/**
 * Kinematic Moon: circular, counter-clockwise (seen from +Y) in the XZ plane,
 * tidally locked — body-fixed −X always faces Earth.
 */
export const MOON_BODY: Body = {
  name: 'MOON',
  mu: MOON.mu,
  radius: MOON.radius,
  atmosphere: 0,
  soi: MOON.soiRadius,
  positionAt(t) {
    const a = MOON_RATE * t;
    return new Vector3(MOON.orbitRadius * Math.cos(a), 0, -MOON.orbitRadius * Math.sin(a));
  },
  velocityAt(t) {
    const a = MOON_RATE * t;
    const v = MOON.orbitRadius * MOON_RATE;
    return new Vector3(-v * Math.sin(a), 0, -v * Math.cos(a));
  },
  spinAt: (t) => MOON_RATE * t,
};

export const BODIES = { EARTH: EARTH_BODY, MOON: MOON_BODY } as const;

/** Angular velocity vector of a body's spin (rad/s, about +Y). */
export function spinRate(body: Body): number {
  return body === MOON_BODY ? MOON_RATE : (2 * Math.PI) / EARTH.siderealDay;
}
