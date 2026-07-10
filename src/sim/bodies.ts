import { Vector3 } from 'three';
import { EARTH, MOON } from '../constants';

export interface Body {
  name: string;
  mu: number;
  radius: number;
  /** Whether reaching the surface can be a splashdown and drag applies. */
  hasAtmosphere: boolean;
  /** Position in Earth-centered inertial space at mission time t (s). */
  positionAt(t: number): Vector3;
  velocityAt(t: number): Vector3;
}

export const EARTH_BODY: Body = {
  name: 'EARTH',
  mu: EARTH.mu,
  radius: EARTH.radius,
  hasAtmosphere: true,
  positionAt: () => new Vector3(),
  velocityAt: () => new Vector3(),
};

/** Kinematic Moon: analytic circular ephemeris in the equatorial plane. */
export const MOON_BODY: Body = {
  name: 'MOON',
  mu: MOON.mu,
  radius: MOON.radius,
  hasAtmosphere: false,
  positionAt(t: number): Vector3 {
    const a = MOON.startAngle + (2 * Math.PI * t) / MOON.orbitPeriod;
    return new Vector3(MOON.orbitRadius * Math.cos(a), 0, -MOON.orbitRadius * Math.sin(a));
  },
  velocityAt(t: number): Vector3 {
    const a = MOON.startAngle + (2 * Math.PI * t) / MOON.orbitPeriod;
    const w = (2 * Math.PI) / MOON.orbitPeriod;
    const v = MOON.orbitRadius * w;
    return new Vector3(-v * Math.sin(a), 0, -v * Math.cos(a));
  },
};
