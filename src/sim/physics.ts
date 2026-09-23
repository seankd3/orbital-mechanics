import { Vector3 } from 'three';
import { ATMOSPHERE, EARTH } from '../constants';

export type AccelFn = (p: Vector3, v: Vector3) => Vector3;

export function gravityAccel(pos: Vector3, mu: number): Vector3 {
  const r = pos.length();
  return pos.clone().multiplyScalar(-mu / (r * r * r));
}

/** Exponential Earth atmosphere, kg/m³; zero above the ceiling. */
export function airDensity(altitude: number): number {
  if (altitude > ATMOSPHERE.ceiling) return 0;
  return ATMOSPHERE.seaLevelDensity * Math.exp(-Math.max(altitude, 0) / ATMOSPHERE.scaleHeight);
}

export interface Aero {
  /** Drag coefficient × reference area, m². */
  cdA: number;
  /** Lift-to-drag ratio (0 for a ballistic shape). */
  liftToDrag: number;
  /** Unit lift direction (⟂ velocity) in world space, when lift > 0. */
  liftDir?: Vector3;
}

/** Drag (+ lift) acceleration in Earth's atmosphere. */
export function aeroAccel(pos: Vector3, vel: Vector3, mass: number, aero: Aero): Vector3 {
  const rho = airDensity(pos.length() - EARTH.radius);
  const speed = vel.length();
  if (rho === 0 || speed < 1e-6) return new Vector3();
  const drag = (0.5 * rho * speed * speed * aero.cdA) / mass;
  const a = vel.clone().multiplyScalar(-drag / speed);
  if (aero.liftToDrag > 0 && aero.liftDir) a.addScaledVector(aero.liftDir, drag * aero.liftToDrag);
  return a;
}

/**
 * One RK4 step of two-body motion plus an external acceleration
 * (thrust + aero) evaluated per sub-stage.
 */
export function rk4Step(pos: Vector3, vel: Vector3, dt: number, extra: AccelFn, mu: number): void {
  const a = (p: Vector3, v: Vector3) => gravityAccel(p, mu).add(extra(p, v));

  const k1v = a(pos, vel);
  const k1p = vel.clone();

  const k2p = vel.clone().addScaledVector(k1v, dt / 2);
  const k2v = a(pos.clone().addScaledVector(k1p, dt / 2), k2p);

  const k3p = vel.clone().addScaledVector(k2v, dt / 2);
  const k3v = a(pos.clone().addScaledVector(k2p, dt / 2), k3p);

  const k4p = vel.clone().addScaledVector(k3v, dt);
  const k4v = a(pos.clone().addScaledVector(k3p, dt), k4p);

  pos.addScaledVector(k1p.add(k2p.multiplyScalar(2)).add(k3p.multiplyScalar(2)).add(k4p), dt / 6);
  vel.addScaledVector(k1v.add(k2v.multiplyScalar(2)).add(k3v.multiplyScalar(2)).add(k4v), dt / 6);
}

/** Orbital frame at a state: prograde, orbit normal, radial-out (unit vectors). */
export function orbitalFrame(pos: Vector3, vel: Vector3): { prograde: Vector3; normal: Vector3; radial: Vector3 } {
  const prograde = vel.clone().normalize();
  const normal = new Vector3().crossVectors(pos, vel).normalize();
  const radial = new Vector3().crossVectors(prograde, normal).normalize();
  return { prograde, normal, radial };
}
