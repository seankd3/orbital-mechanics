import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EARTH, MOON } from '../constants';
import { Orbit } from './orbit';
import { aeroAccel, rk4Step } from './physics';

const LEO = EARTH.radius + 400_000;
const vCirc = Math.sqrt(EARTH.mu / LEO);
const none = () => new Vector3();

function energy(p: Vector3, v: Vector3, mu = EARTH.mu): number {
  return v.lengthSq() / 2 - mu / p.length();
}

function integrate(p: Vector3, v: Vector3, duration: number, mu: number, step = 1): void {
  const n = Math.ceil(duration / step);
  for (let i = 0; i < n; i++) rk4Step(p, v, duration / n, none, mu);
}

describe('Orbit (harvested elements, now elliptic + hyperbolic)', () => {
  it('reads a circular orbit', () => {
    const o = Orbit.fromState(new Vector3(LEO, 0, 0), new Vector3(0, 0, -vCirc), EARTH.mu);
    expect(o.e).toBeLessThan(1e-9);
    expect(o.a).toBeCloseTo(LEO, 0);
    expect(o.period).toBeCloseTo(2 * Math.PI * Math.sqrt(LEO ** 3 / EARTH.mu), 3);
    expect(o.inclination).toBeCloseTo(0, 9);
  });

  it.each([
    ['ellipse', new Vector3(400, 1200, -vCirc * 1.1)],
    ['hyperbola', new Vector3(900, 300, -vCirc * 1.6)],
  ])('reconstructs its defining state exactly (%s)', (_, v) => {
    const p = new Vector3(LEO, 1_000_000, -300_000);
    const o = Orbit.fromState(p, v, EARTH.mu, 500);
    const vel = new Vector3();
    const pos = o.stateAt(500, new Vector3(), vel);
    expect(pos.distanceTo(p)).toBeLessThan(1e-3);
    expect(vel.distanceTo(v)).toBeLessThan(1e-6);
  });

  it.each([
    ['LEO ellipse', LEO, vCirc * 1.2, EARTH.mu, 20_000],
    ['translunar ellipse', LEO, 10_900, EARTH.mu, 200_000],
    ['lunar flyby hyperbola', MOON.radius + 110_000, 2_500, MOON.mu, 30_000],
    ['Earth escape hyperbola', LEO, 12_000, EARTH.mu, 50_000],
  ])('agrees with RK4 over a long coast (%s)', (_, r, speed, mu, duration) => {
    const p = new Vector3(r, 0, 0);
    const v = new Vector3(0, speed * 0.05, -speed);
    const o = Orbit.fromState(p, v, mu, 0);
    integrate(p, v, duration, mu, 0.5);
    const kepler = o.stateAt(duration);
    expect(kepler.distanceTo(p) / p.length()).toBeLessThan(1e-6);
  });

  it('finds radius crossings and apsides in time', () => {
    const o = Orbit.fromState(new Vector3(LEO, 0, 0), new Vector3(0, 0, -vCirc * 1.1), EARTH.mu, 0);
    const tAp = o.nextApoapsis(0)!;
    expect(o.stateAt(tAp).length()).toBeCloseTo(o.apoapsis, 0);
    expect(tAp).toBeCloseTo(o.period / 2, 3);
    const mid = (o.periapsis + o.apoapsis) / 2;
    const tOut = o.nextRadiusCrossing(mid, 0, 1)!;
    const tIn = o.nextRadiusCrossing(mid, 0, -1)!;
    expect(tOut).toBeLessThan(tAp);
    expect(tIn).toBeGreaterThan(tAp);
    expect(o.stateAt(tOut).length()).toBeCloseTo(mid, 0);
    expect(o.stateAt(tIn).length()).toBeCloseTo(mid, 0);
    expect(o.nextRadiusCrossing(o.apoapsis * 2, 0, 1)).toBeNull();
  });

  it('never returns a past time on a hyperbola', () => {
    const o = Orbit.fromState(new Vector3(LEO, 0, 0), new Vector3(0, 0, -12_000), EARTH.mu, 0);
    expect(o.nextPeriapsis(10)).toBeNull();
    const tOut = o.nextRadiusCrossing(EARTH.radius * 10, 0, 1)!;
    expect(o.stateAt(tOut).length()).toBeCloseTo(EARTH.radius * 10, -1);
  });
});

describe('RK4 integrator', () => {
  it('closes a circular LEO orbit and conserves energy', () => {
    const p = new Vector3(LEO, 0, 0);
    const v = new Vector3(0, 0, -vCirc);
    const e0 = energy(p, v);
    const period = 2 * Math.PI * Math.sqrt(LEO ** 3 / EARTH.mu);
    integrate(p, v, period, EARTH.mu, 2);
    expect(p.distanceTo(new Vector3(LEO, 0, 0))).toBeLessThan(5);
    expect(Math.abs((energy(p, v) - e0) / e0)).toBeLessThan(1e-9);
  });
});

describe('atmosphere', () => {
  const aero = { cdA: 15, liftToDrag: 0.3, liftDir: new Vector3(1, 0, 0) };
  it('drags against velocity and lifts along the lift vector below the ceiling', () => {
    const a = aeroAccel(new Vector3(EARTH.radius + 70_000, 0, 0), new Vector3(0, 0, -7800), 5000, aero);
    expect(a.z).toBeGreaterThan(0);
    expect(a.x / a.z).toBeCloseTo(0.3, 6);
  });
  it('vanishes above the ceiling', () => {
    const a = aeroAccel(new Vector3(EARTH.radius + 200_000, 0, 0), new Vector3(0, 0, -7800), 5000, aero);
    expect(a.length()).toBe(0);
  });
});
