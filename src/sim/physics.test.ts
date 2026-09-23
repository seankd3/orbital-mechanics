import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EARTH } from '../constants';
import {
  dragAccel,
  elementsFromState,
  meanToTrueAnomaly,
  rk4Step,
  stateAtTrueAnomaly,
  trueToMeanAnomaly,
} from './physics';

const LEO = EARTH.radius + 400_000;
const vCirc = Math.sqrt(EARTH.mu / LEO);

function energy(p: Vector3, v: Vector3, mu = EARTH.mu): number {
  return v.lengthSq() / 2 - mu / p.length();
}

describe('orbital elements', () => {
  it('reads a circular orbit', () => {
    const el = elementsFromState(new Vector3(LEO, 0, 0), new Vector3(0, 0, -vCirc));
    expect(el.eccentricity).toBeLessThan(1e-9);
    expect(el.semiMajorAxis).toBeCloseTo(LEO, 0);
    expect(el.period).toBeCloseTo(2 * Math.PI * Math.sqrt(LEO ** 3 / EARTH.mu), 3);
    expect(el.inclination).toBeCloseTo(0, 9);
  });

  it('reconstructs position and velocity from the perifocal basis', () => {
    const p = new Vector3(LEO, 1_000_000, -300_000);
    const v = new Vector3(400, 1200, -vCirc * 1.1);
    const el = elementsFromState(p, v);
    const vel = new Vector3();
    const pos = stateAtTrueAnomaly(el, el.trueAnomaly, vel);
    expect(pos.distanceTo(p)).toBeLessThan(1e-3);
    expect(vel.distanceTo(v)).toBeLessThan(1e-6);
  });

  it('round-trips true and mean anomaly', () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.97]) {
      for (const nu of [0.1, 1, 2, 3, 4, 5.5]) {
        const back = meanToTrueAnomaly(trueToMeanAnomaly(nu, e), e);
        expect(back).toBeCloseTo(nu, 9);
      }
    }
  });
});

describe('RK4 integrator', () => {
  it('closes a circular LEO orbit and conserves energy', () => {
    const p = new Vector3(LEO, 0, 0);
    const v = new Vector3(0, 0, -vCirc);
    const e0 = energy(p, v);
    const period = 2 * Math.PI * Math.sqrt(LEO ** 3 / EARTH.mu);
    const steps = Math.ceil(period / 2);
    const dt = period / steps;
    for (let i = 0; i < steps; i++) rk4Step(p, v, dt, () => new Vector3());
    expect(p.distanceTo(new Vector3(LEO, 0, 0))).toBeLessThan(5);
    expect(Math.abs((energy(p, v) - e0) / e0)).toBeLessThan(1e-9);
  });
});

describe('atmosphere', () => {
  it('drags against velocity below the ceiling and not above it', () => {
    const v = new Vector3(0, 0, -7800);
    const low = dragAccel(new Vector3(EARTH.radius + 80_000, 0, 0), v, 5000);
    expect(low.z).toBeGreaterThan(0);
    const high = dragAccel(new Vector3(EARTH.radius + 200_000, 0, 0), v, 5000);
    expect(high.length()).toBe(0);
  });
});
