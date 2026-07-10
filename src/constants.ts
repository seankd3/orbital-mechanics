export const G = 6.6743e-11;

export const EARTH = {
  radius: 6_371_000, // m
  mass: 5.972e24, // kg
  mu: G * 5.972e24,
  siderealDay: 86_164, // s
};

export const MOON = {
  radius: 1_737_400, // m
  mass: 7.342e22, // kg
  mu: G * 7.342e22,
  /** Sphere of influence — inside it the Moon becomes the gravitating primary. */
  soiRadius: 66_100_000, // m
  orbitRadius: 384_400_000, // m
  orbitPeriod: 27.32 * 86_400, // s
  startAngle: (54 * Math.PI) / 180,
};

/** Simulation runs in SI meters; render space is meters * RENDER_SCALE. */
export const RENDER_SCALE = 1e-6;

export const SHIP = {
  dryMass: 12_000, // kg
  fuelMass: 18_000, // kg
  thrust: 90_000, // N (SPS-class engine)
  isp: 314, // s
  g0: 9.80665,
  /** RCS translation: 2 jets × 445 N, separate propellant budget. */
  rcsThrust: 890, // N
  rcsFuelMass: 500, // kg
  rcsIsp: 290, // s
  /** Visual icon scale — the real ~11 m vehicle would be sub-pixel. */
  visualScale: 0.02,
};

export const START_ORBIT = {
  altitude: 400_000, // m
  inclination: (30 * Math.PI) / 180,
};

export const ATMOSPHERE = {
  /** Above this altitude drag is ignored (and time warp may go on rails). */
  ceiling: 140_000, // m
  seaLevelDensity: 1.225, // kg/m³
  scaleHeight: 8_500, // m
  /** Drag coefficient × reference area for the CSM, blunt-end first. */
  cdA: 25, // m²
};

export const WARP_LEVELS = [1, 5, 25, 100, 1_000, 10_000, 100_000];
/** Burning or rotating above this warp is not allowed (auto-drops to 1×). */
export const MAX_PHYSICS_WARP = 5;
/** Above this warp, coast on rails via Kepler propagation. */
export const MAX_NUMERIC_WARP = 100;
