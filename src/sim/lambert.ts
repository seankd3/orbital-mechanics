import { Vector3 } from 'three';

/**
 * Lambert's problem by universal variables (Curtis, Alg. 5.2): the
 * less-than-one-revolution conic from r1 to r2 in time dt, travelling in
 * the sense of `normal` (an orbit's angular-momentum direction).
 * Returns the departure and arrival velocities, or null if unsolved.
 */
export function lambert(r1: Vector3, r2: Vector3, dt: number, mu: number, normal: Vector3): { v1: Vector3; v2: Vector3 } | null {
  const R1 = r1.length();
  const R2 = r2.length();
  const cross = new Vector3().crossVectors(r1, r2);
  let dTheta = Math.acos(Math.max(-1, Math.min(1, r1.dot(r2) / (R1 * R2))));
  if (cross.dot(normal) < 0) dTheta = 2 * Math.PI - dTheta;
  const A = Math.sin(dTheta) * Math.sqrt((R1 * R2) / (1 - Math.cos(dTheta)));
  if (!isFinite(A) || Math.abs(A) < 1e-9) return null;

  const y = (z: number) => R1 + R2 + (A * (z * S(z) - 1)) / Math.sqrt(C(z));
  const F = (z: number) => {
    const yz = y(z);
    return (yz / C(z)) ** 1.5 * S(z) + A * Math.sqrt(yz) - Math.sqrt(mu) * dt;
  };

  // Bracket the root: F increases with z; y(z) must stay positive.
  let hi = 4 * Math.PI * Math.PI - 1e-6;
  let lo = -4 * Math.PI * Math.PI;
  while (lo < hi && !(y(lo) > 0)) lo += 0.1;
  if (!(lo < hi && F(lo) < 0 && F(hi) > 0)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (F(mid) > 0) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-12) break;
  }
  const z = (lo + hi) / 2;
  const yz = y(z);
  const f = 1 - yz / R1;
  const g = A * Math.sqrt(yz / mu);
  const gDot = 1 - yz / R2;
  const v1 = r2.clone().addScaledVector(r1, -f).divideScalar(g);
  const v2 = r2.clone().multiplyScalar(gDot).sub(r1).divideScalar(g);
  return { v1, v2 };
}

/** Stumpff C(z). */
function C(z: number): number {
  if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 1 / 2 - z / 24;
}

/** Stumpff S(z). */
function S(z: number): number {
  if (z > 1e-8) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z);
    return (Math.sinh(s) - s) / (s * s * s);
  }
  return 1 / 6 - z / 120;
}
