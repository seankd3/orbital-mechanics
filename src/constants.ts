export const G = 6.6743e-11;
export const G0 = 9.80665;

export const EARTH = {
  radius: 6_371_000, // m
  mu: G * 5.972e24,
  siderealDay: 86_164, // s
};

export const MOON = {
  radius: 1_737_400, // m
  mu: G * 7.342e22,
  /** Sphere of influence — inside it the Moon becomes the gravitating primary. */
  soiRadius: 66_100_000, // m
  orbitRadius: 384_400_000, // m
  orbitPeriod: 27.32 * 86_400, // s
};

export const ATMOSPHERE = {
  /** Above this altitude drag is ignored and coasting stays on Kepler rails. */
  ceiling: 140_000, // m
  /** Entry interface: where entry is scored and flight-path angle is read. */
  interface: 122_000, // m
  seaLevelDensity: 1.225, // kg/m³
  scaleHeight: 7_200, // m
};

/** Simulation runs in SI meters; render space is meters × RENDER_SCALE. */
export const RENDER_SCALE = 1e-6;

/** Warp multipliers selectable with , and . */
export const WARP_LEVELS = [1, 2, 5, 10, 50, 100, 1_000, 10_000, 100_000];
/** Highest warp allowed while an engine burns or the craft is in the air. */
export const MAX_POWERED_WARP = 10;
