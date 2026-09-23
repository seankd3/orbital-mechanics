import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EARTH } from '../constants';
import { EARTH_BODY, MOON_BODY } from './bodies';
import { crossSoi, lunarPass, nextEvent, predictPath } from './coast';
import { Orbit } from './orbit';

const R0 = EARTH.radius + 185_000;

/** A translunar state: circular parking orbit at `phase`, plus a prograde kick. */
function translunar(phase: number, speed = 10_950) {
  const pos = new Vector3(R0 * Math.cos(phase), 0, -R0 * Math.sin(phase));
  const vel = new Vector3(-Math.sin(phase), 0, -Math.cos(phase)).multiplyScalar(speed);
  return { pos, vel };
}

function firstCapture() {
  for (let deg = 0; deg < 360; deg += 1) {
    const { pos, vel } = translunar((deg * Math.PI) / 180);
    const arcs = predictPath(EARTH_BODY, pos, vel, 0, 10 * 86_400);
    if (arcs.some((a) => a.primary === MOON_BODY)) return { pos, vel, arcs };
  }
  throw new Error('no capture found');
}

describe('patched-conic coast', () => {
  it('stops at the lunar SOI boundary and hands off to the Moon', () => {
    const { arcs } = firstCapture();
    const [earthArc, moonArc] = arcs;
    expect(earthArc.end).toBe('soi-enter');
    const at = earthArc.orbit.stateAt(earthArc.t1);
    const d = at.distanceTo(MOON_BODY.positionAt(earthArc.t1));
    expect(Math.abs(d - MOON_BODY.soi)).toBeLessThan(5); // m
    expect(moonArc.t0).toBe(earthArc.t1);
    expect(moonArc.orbit.closed).toBe(false);
  });

  it('gives the same answer whether coasted in one jump or thousands of frames', () => {
    const { pos, vel, arcs } = firstCapture();
    const tEnd = arcs[1].t0 + 3600;

    // Frame-by-frame, as the sim flies on rails at 10,000× warp.
    const p = pos.clone();
    const v = vel.clone();
    let body = EARTH_BODY as typeof EARTH_BODY | typeof MOON_BODY;
    let orbit = Orbit.fromState(p, v, body.mu, 0);
    let t = 0;
    while (t < tEnd) {
      const tn = Math.min(tEnd, t + 800);
      const ev = nextEvent(orbit, body, t, tn);
      const tStop = ev ? ev.t : tn;
      orbit.stateAt(tStop, p, v);
      if (ev && (ev.kind === 'soi-enter' || ev.kind === 'soi-exit')) {
        body = crossSoi(ev.kind, p, v, tStop);
        orbit = Orbit.fromState(p, v, body.mu, tStop);
      }
      t = tStop;
    }
    expect(body).toBe(MOON_BODY);
    const predicted = arcs[1].orbit.stateAt(tEnd);
    expect(predicted.distanceTo(p)).toBeLessThan(1); // m
  });

  it('signs a lunar pass by its direction around the Moon', () => {
    const { arcs } = firstCapture();
    const pass = lunarPass(arcs)!;
    expect(pass.captured).toBe(true);
    expect(Math.abs(pass.signedRadius)).toBe(arcs[1].orbit.periapsis);
  });

  it('reports atmospheric interface on a decaying Earth orbit', () => {
    const pos = new Vector3(R0, 0, 0);
    const vel = new Vector3(0, 0, -Math.sqrt(EARTH.mu / R0) + 60);
    const arcs = predictPath(EARTH_BODY, pos, vel, 0, 86_400);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].end).toBe('atmosphere');
    expect(arcs[0].orbit.stateAt(arcs[0].t1).length() - EARTH.radius).toBeCloseTo(EARTH_BODY.atmosphere, -1);
  });
});
