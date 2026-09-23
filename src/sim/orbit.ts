import { Vector3 } from 'three';

const TWO_PI = Math.PI * 2;

/**
 * An immutable two-body conic (ellipse or hyperbola) anchored in time.
 *
 * Orientation is kept frame-free as a perifocal basis (`eHat` toward
 * periapsis, `qHat` 90° ahead along the motion), so reconstruction is exact
 * in any frame. Time enters only through the mean anomaly, which makes
 * `stateAt` an O(1) Kepler solve: this is both the "rails" the craft coast
 * on and the predictor that draws and targets trajectories.
 */
export class Orbit {
  readonly e: number;
  /** Semi-major axis (m); negative for hyperbolas. */
  readonly a: number;
  /** Semi-latus rectum (m). */
  readonly p: number;
  /** Specific angular momentum magnitude. */
  readonly h: number;
  readonly hVec: Vector3;
  readonly eHat: Vector3;
  readonly qHat: Vector3;
  /** Mean motion (rad/s). */
  readonly n: number;
  /** Mean anomaly at `epoch` (unwrapped). */
  readonly M0: number;

  private constructor(
    readonly mu: number,
    readonly epoch: number,
    pos: Vector3,
    vel: Vector3,
  ) {
    this.hVec = new Vector3().crossVectors(pos, vel);
    this.h = this.hVec.length();
    const r = pos.length();
    const eVec = new Vector3()
      .crossVectors(vel, this.hVec)
      .divideScalar(mu)
      .addScaledVector(pos, -1 / r);
    this.e = eVec.length();
    this.a = -mu / (2 * (vel.lengthSq() / 2 - mu / r));
    this.p = (this.h * this.h) / mu;
    this.eHat = this.e > 1e-9 ? eVec.divideScalar(this.e) : pos.clone().divideScalar(r);
    this.qHat = new Vector3().crossVectors(this.hVec, this.eHat).normalize();
    this.n = Math.sqrt(mu / Math.abs(this.a) ** 3);
    this.M0 = this.meanFromTrue(Math.atan2(pos.dot(this.qHat), pos.dot(this.eHat)));
  }

  static fromState(pos: Vector3, vel: Vector3, mu: number, t = 0): Orbit {
    return new Orbit(mu, t, pos, vel);
  }

  get closed(): boolean {
    return this.e < 1;
  }

  /** Periapsis radius (m from the primary's center). */
  get periapsis(): number {
    return this.p / (1 + this.e);
  }

  /** Apoapsis radius; Infinity on an open orbit. */
  get apoapsis(): number {
    return this.closed ? this.p / (1 - this.e) : Infinity;
  }

  get period(): number {
    return this.closed ? TWO_PI / this.n : Infinity;
  }

  /** Inclination to the XZ reference plane (Y-up world). */
  get inclination(): number {
    return Math.acos(Math.max(-1, Math.min(1, this.hVec.y / this.h)));
  }

  radiusAt(nu: number): number {
    return this.p / (1 + this.e * Math.cos(nu));
  }

  meanAnomalyAt(t: number): number {
    return this.M0 + this.n * (t - this.epoch);
  }

  trueAnomalyAt(t: number): number {
    return this.trueFromMean(this.meanAnomalyAt(t));
  }

  stateAt(t: number, outPos = new Vector3(), outVel?: Vector3): Vector3 {
    return this.stateAtTrueAnomaly(this.trueAnomalyAt(t), outPos, outVel);
  }

  stateAtTrueAnomaly(nu: number, outPos = new Vector3(), outVel?: Vector3): Vector3 {
    const c = Math.cos(nu);
    const s = Math.sin(nu);
    const r = this.p / (1 + this.e * c);
    outPos.copy(this.eHat).multiplyScalar(r * c).addScaledVector(this.qHat, r * s);
    if (outVel) {
      const k = this.mu / this.h;
      outVel.copy(this.eHat).multiplyScalar(-k * s).addScaledVector(this.qHat, k * (this.e + c));
    }
    return outPos;
  }

  /** First time ≥ `after` at which the craft passes true anomaly `nu`, or null. */
  timeAtTrueAnomaly(nu: number, after: number): number | null {
    const target = this.meanFromTrue(nu);
    if (this.closed) {
      let dM = (target - this.meanAnomalyAt(after)) % TWO_PI;
      if (dM < 0) dM += TWO_PI;
      return after + dM / this.n;
    }
    const t = this.epoch + (target - this.M0) / this.n;
    return t >= after ? t : null;
  }

  /**
   * First time ≥ `after` the orbit crosses `radius` going outward (+1) or
   * inward (−1), or null if it never does.
   */
  nextRadiusCrossing(radius: number, after: number, direction: 1 | -1): number | null {
    if (this.e < 1e-9) return null;
    const cosNu = (this.p / radius - 1) / this.e;
    if (cosNu < -1 || cosNu > 1) return null;
    return this.timeAtTrueAnomaly(direction * Math.acos(cosNu), after);
  }

  nextPeriapsis(after: number): number | null {
    return this.timeAtTrueAnomaly(0, after);
  }

  nextApoapsis(after: number): number | null {
    return this.closed ? this.timeAtTrueAnomaly(Math.PI, after) : null;
  }

  private meanFromTrue(nu: number): number {
    const e = this.e;
    if (e < 1) {
      const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
      return E - e * Math.sin(E);
    }
    const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    return e * Math.sinh(F) - F;
  }

  private trueFromMean(M: number): number {
    const e = this.e;
    if (e < 1) {
      const E = solveKeplerElliptic(M, e);
      return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    }
    const F = solveKeplerHyperbolic(M, e);
    return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(F / 2));
  }
}

/** Solve M = E − e·sin E (any M; result shares M's revolution). */
export function solveKeplerElliptic(M: number, e: number): number {
  const rev = Math.round(M / TWO_PI) * TWO_PI;
  const m = M - rev; // (−π, π]
  let E = e > 0.8 ? Math.sign(m) * Math.PI * 0.9 || 0.1 : m;
  for (let i = 0; i < 50; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E + rev;
}

/** Solve M = e·sinh F − F. */
export function solveKeplerHyperbolic(M: number, e: number): number {
  let F = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8);
  for (let i = 0; i < 60; i++) {
    const d = (e * Math.sinh(F) - F - M) / (e * Math.cosh(F) - 1);
    F -= d;
    if (Math.abs(d) < 1e-13 * Math.max(1, Math.abs(F))) break;
  }
  return F;
}
