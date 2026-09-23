import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EARTH, MOON } from '../constants';
import { EARTH_BODY, MOON_BODY } from './bodies';
import { lookQuaternion, pointQuaternion } from './executor';
import { ascentGuidance, currentBank, descentGuidance, dockingGuidance, entryBank } from './guidance';
import { Orbit } from './orbit';
import { Simulation } from './simulation';

const DT = 1 / 30;

/** Clockwise (Apollo-style) lunar orbit state at periapsis rp with apoapsis ra. */
function lunarPeriapsis(rp: number, ra: number): { pos: Vector3; vel: Vector3 } {
  const a = (rp + ra) / 2;
  const v = Math.sqrt(MOON.mu * (2 / rp - 1 / a));
  return { pos: new Vector3(-rp, 0, 0), vel: new Vector3(0, 0, -v) };
}

function lmAtPdi(): Simulation {
  const sim = new Simulation();
  const { pos, vel } = lunarPeriapsis(MOON.radius + 15_000, MOON.radius + 110_000);
  sim.primary = MOON_BODY;
  sim.csm.reset(pos, vel);
  sim.lm.reset(pos, vel);
  sim.docked = false;
  sim.activeId = 'lm';
  sim.csm.position.set(-(MOON.radius + 110_000), 0, 0);
  sim.csm.velocity.set(0, 0, -Math.sqrt(MOON.mu / (MOON.radius + 110_000)));
  sim.lm.pointAlong(vel.clone().negate());
  return sim;
}

export function flyDescent(sim: Simulation): void {
  for (let i = 0; i < 60 * 30 * 20 && !sim.ship.landed && !sim.outcome; i++) {
    const cue = descentGuidance(sim.ship, sim.primary);
    sim.hold = pointQuaternion(sim.ship, cue.dir);
    sim.ship.throttle = cue.throttle;
    sim.step(DT);
  }
  sim.ship.throttle = 0;
  sim.hold = null;
}

describe('powered descent guidance', () => {
  it('lands the LM softly from a 15 km perilune with fuel to spare', () => {
    const sim = lmAtPdi();
    flyDescent(sim);
    expect(sim.outcome).toBeNull();
    expect(sim.ship.landed).toBe(true);
    const c = sim.lastContact!;
    expect(c.verticalSpeed).toBeLessThan(1.5);
    expect(c.horizontalSpeed).toBeLessThan(1);
    expect(c.tilt).toBeLessThan(10);
    expect(sim.ship.fuelFraction).toBeGreaterThan(0.05);
  });
});

describe('ascent guidance', () => {
  it('flies the APS from the surface to a 17 × 83 km class orbit', () => {
    const sim = lmAtPdi();
    flyDescent(sim);
    sim.warp = 1000;
    sim.step(1); // let the Moon turn under the LM for a while
    sim.warp = 1;
    sim.ship.dropStage();
    const rf = MOON.radius + 18_000;
    const a = (rf + MOON.radius + 83_000) / 2;
    const insertion = { radius: rf, speed: Math.sqrt(MOON.mu * (2 / rf - 1 / a)) };
    const normal = new Vector3(0, -1, 0);
    for (let i = 0; i < 60 * 30 * 15 && !sim.outcome; i++) {
      const cue = ascentGuidance(sim.ship, sim.primary, normal, insertion);
      if (cue.toGo <= 0) break;
      sim.hold = pointQuaternion(sim.ship, cue.dir);
      sim.ship.throttle = sim.ship.landed && sim.met < 0 ? 0 : 1;
      sim.step(DT);
    }
    sim.ship.throttle = 0;
    const o = Orbit.fromState(sim.ship.position, sim.ship.velocity, MOON.mu);
    expect(sim.outcome).toBeNull();
    expect(o.periapsis - MOON.radius).toBeGreaterThan(12_000);
    expect(o.apoapsis - MOON.radius).toBeGreaterThan(60_000);
    expect(o.apoapsis - MOON.radius).toBeLessThan(110_000);
    expect(sim.ship.fuel).toBeGreaterThan(0);
  });
});

describe('entry bank guidance', () => {
  it('flies the CM from entry interface to splashdown under 7 g', () => {
    const sim = new Simulation();
    const r = EARTH.radius + 122_000;
    const gamma = (-6.5 * Math.PI) / 180;
    const v = 11_000;
    const pos = new Vector3(r, 0, 0);
    const vel = new Vector3(v * Math.sin(gamma), 0, -v * Math.cos(gamma));
    sim.primary = EARTH_BODY;
    sim.csm.reset(pos, vel);
    sim.csm.stagesDropped = 2; // CM only
    sim.lmAlive = false;
    sim.docked = true;
    sim.csm.quaternion.copy(lookQuaternion(vel.clone().negate(), pos));
    let bankErrMax = 0;
    for (let i = 0; i < 30 * 60 * 30 && !sim.outcome; i++) {
      const target = entryBank(sim).bank;
      const bank = currentBank(sim);
      const side = bank >= 0 ? 1 : -1;
      const err = side * target - bank;
      sim.rotation = { pitch: 0, yaw: 0, roll: Math.max(-1, Math.min(1, -2 * err - 1.5 * sim.ship.angularVelocity.z)) };
      sim.step(DT);
      if (sim.gLoad > 1) bankErrMax = Math.max(bankErrMax, Math.abs(err));
    }
    expect(sim.outcome?.kind).toBe('splashdown');
    expect(sim.peakG).toBeGreaterThan(2);
    expect(sim.peakG).toBeLessThan(7);
  });
});

describe('docking guidance', () => {
  it('closes 1 km of separation to a gentle contact on RCS', () => {
    const sim = new Simulation();
    const r = MOON.radius + 110_000;
    const v = Math.sqrt(MOON.mu / r);
    sim.primary = MOON_BODY;
    sim.csm.reset(new Vector3(-r, 0, 0), new Vector3(0, 0, -v));
    sim.lm.reset(new Vector3(-r, 0, 1000), new Vector3(2, 0, -v + 3));
    sim.lm.stagesDropped = 1;
    sim.docked = false;
    sim.activeId = 'lm';
    const rcs0 = sim.lm.rcsFuel;
    let contact: number | null = null;
    for (let i = 0; i < 30 * 60 * 20; i++) {
      const g = dockingGuidance(sim)!;
      const rel = sim.relative()!;
      if (rel.range < 15) {
        contact = g.closing;
        break;
      }
      sim.hold = pointQuaternion(sim.ship, rel.pos);
      sim.translation = g.translation;
      sim.step(DT);
    }
    expect(contact).not.toBeNull();
    expect(contact!).toBeLessThan(0.6);
    expect(rcs0 - sim.lm.rcsFuel).toBeLessThan(60);
  });
});
