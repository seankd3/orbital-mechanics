import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EARTH, MOON } from '../constants';
import { EARTH_BODY, MOON_BODY } from './bodies';
import { engineOf, predictBurn, stateOf, type Maneuver } from './burn';
import { lambert } from './lambert';
import { Orbit } from './orbit';
import { BurnGuide } from './executor';
import { Simulation } from './simulation';
import { earthArc, entryAngle, perilune, solveBraking, solveCircularize, solveIntercept, solveMidcourse, solveTei, solveTli, TARGET } from './targeting';

const DT = 1 / 30;

function parkingOrbit(): Simulation {
  const sim = new Simulation();
  const r = EARTH.radius + 185_000;
  const v = Math.sqrt(EARTH.mu / r);
  sim.csm.reset(new Vector3(r, 0, 0), new Vector3(0, 0, -v));
  sim.lm.reset(new Vector3(r, 0, 0), new Vector3(0, 0, -v));
  sim.csm.attachedMass = sim.lm.ownMass;
  sim.primary = EARTH_BODY;
  return sim;
}

/** Fly a maneuver the way P40 would: warp to ignition, hold the cue, burn, cut off. */
function fly(sim: Simulation, m: Maneuver): BurnGuide {
  const guide = new BurnGuide(m, stateOf(sim.ship, sim.primary, sim.met), sim.ship);
  sim.warpUntil = guide.ignition - 20;
  sim.warp = 100_000;
  while (sim.warpUntil !== null) sim.step(DT);
  for (let i = 0; i < 200_000 && guide.phase !== 'done' && !sim.outcome; i++) {
    const cmd = guide.autopilot(sim.ship, sim.met, DT * sim.warp);
    sim.hold = cmd.hold;
    sim.ship.throttle = cmd.throttle;
    sim.step(DT);
    guide.update(sim.ship, sim.met);
  }
  sim.ship.throttle = 0;
  sim.hold = null;
  return guide;
}

/** Coast (at max warp, frame by frame) into the lunar SOI and read the conic's perilune. */
function flownPerilune(sim: Simulation): number {
  sim.warp = 100_000;
  for (let i = 0; i < 100_000 && sim.primary !== MOON_BODY; i++) sim.step(DT);
  const o = sim.orbit;
  return Math.sign(o.hVec.y) * o.periapsis;
}

describe('trans-lunar targeting', () => {
  const sim = parkingOrbit();
  const now = stateOf(sim.ship, sim.primary, sim.met);
  const tli = solveTli(now, engineOf(sim.ship))!;

  it('finds a window whose finite S-IVB burn hits the target perilune', () => {
    expect(tli).not.toBeNull();
    expect(tli.prograde).toBeGreaterThan(3000);
    expect(tli.prograde).toBeLessThan(3300);
    const p = perilune(predictBurn(now, engineOf(sim.ship), tli, 12 * 86_400).arcs)!;
    expect(Math.abs(p - TARGET.perilune)).toBeLessThan(1_000);
  });

  it('flies exactly what it predicted (the prediction is the outcome)', () => {
    const guide = fly(sim, tli);
    expect(Math.abs(guide.remaining(sim.ship))).toBeLessThan(0.1);
    sim.ship.dropStage(); // S-IVB sep
    const predicted = perilune(predictBurn(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship), { tig: sim.met, prograde: 0, normal: 0, radial: 0 }, 12 * 86_400).arcs)!;
    const flown = flownPerilune(sim);
    expect(Math.abs(flown - predicted)).toBeLessThan(10); // m, after a 3-day coast
    // And on the plan: a clean P40 burn needs no midcourse at all.
    expect(Math.abs(flown - TARGET.perilune)).toBeLessThan(2_000);
  });
});

describe('midcourse and lunar orbit insertion', () => {
  it('trims a dispersed approach, then captures into a near-circular orbit', () => {
    const sim = parkingOrbit();
    const tli = solveTli(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship))!;
    fly(sim, { ...tli, prograde: tli.prograde + 1.5 }); // 1.5 m/s overburn
    sim.ship.dropStage();
    const tig = sim.met + 20 * 3600;
    const mcc = solveMidcourse(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship), tig)!;
    expect(mcc).not.toBeNull();
    const size = Math.hypot(mcc.prograde, mcc.radial);
    expect(size).toBeGreaterThan(0.1);
    expect(size).toBeLessThan(40);
    fly(sim, mcc);

    // Coast into the SOI, then LOI.
    sim.warp = 100_000;
    while (sim.primary !== MOON_BODY) sim.step(DT);
    const loi = solveCircularize(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship))!;
    expect(-loi.prograde).toBeGreaterThan(700);
    expect(-loi.prograde).toBeLessThan(1100);
    fly(sim, loi);
    const o = Orbit.fromState(sim.ship.position, sim.ship.velocity, MOON.mu);
    expect(o.e).toBeLessThan(0.01);
    expect(Math.abs(o.periapsis - TARGET.lunarOrbit)).toBeLessThan(10_000);
  });
});

function lunarOrbit(rp: number, ra: number, angle: number) {
  const a = (rp + ra) / 2;
  const v = Math.sqrt(MOON.mu * (2 / rp - 1 / a));
  // Clockwise seen from +Y, periapsis at `angle`.
  const pos = new Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(rp);
  const vel = new Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(v);
  return { pos, vel };
}

describe('trans-Earth injection', () => {
  it('burns for home and arrives in the entry corridor', () => {
    const sim = new Simulation();
    const { pos, vel } = lunarOrbit(TARGET.lunarOrbit, TARGET.lunarOrbit, 0.3);
    sim.primary = MOON_BODY;
    sim.met = 80 * 3600;
    sim.csm.reset(pos, vel);
    sim.csm.stagesDropped = 1;
    sim.csm.fuels[1] = 10_000;
    sim.lmAlive = false;
    const tei = solveTei(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship))!;
    expect(tei).not.toBeNull();
    fly(sim, tei);
    const arcs = predictBurn(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship), { tig: sim.met, prograde: 0, normal: 0, radial: 0 }, 12 * 86_400).arcs;
    const home = earthArc(arcs)!;
    expect(home).not.toBeNull();
    expect(Math.abs(entryAngle(home.orbit) - TARGET.entryAngle)).toBeLessThan((0.3 * Math.PI) / 180);
    const tripDays = (home.t1 - sim.met) / 86_400;
    expect(tripDays).toBeGreaterThan(1.5);
    expect(tripDays).toBeLessThan(4);
  });
});

describe('rendezvous', () => {
  it('intercepts the CSM from the LM insertion orbit and brakes close aboard', () => {
    const sim = new Simulation();
    const csm = lunarOrbit(TARGET.lunarOrbit, TARGET.lunarOrbit, -0.5); // clockwise: ahead
    const lm = lunarOrbit(MOON.radius + 17_000, MOON.radius + 83_000, 0);
    sim.primary = MOON_BODY;
    sim.csm.reset(csm.pos, csm.vel);
    sim.lm.reset(lm.pos, lm.vel);
    sim.lm.stagesDropped = 1;
    sim.docked = false;
    sim.activeId = 'lm';
    const chaser = stateOf(sim.lm, sim.primary, sim.met);
    const target = stateOf(sim.csm, sim.primary, sim.met);
    const plan = solveIntercept(chaser, target, 2400)!;
    expect(plan).not.toBeNull();
    fly(sim, plan.tpi);
    const brake = solveBraking(stateOf(sim.lm, sim.primary, sim.met), stateOf(sim.csm, sim.primary, sim.met), plan.arrival - sim.met + 600)!;
    fly(sim, brake);
    const rel = sim.relative()!;
    expect(rel.range).toBeLessThan(3_000);
    expect(rel.vel.length()).toBeLessThan(3);
  });
});

describe('lambert', () => {
  it('matches a Kepler coast', () => {
    const r1 = new Vector3(MOON.radius + 20_000, 0, 0);
    const v1 = new Vector3(0, 0, -1_690);
    const o = Orbit.fromState(r1, v1, MOON.mu, 0);
    const r2 = o.stateAt(2400);
    const sol = lambert(r1, r2, 2400, MOON.mu, new Vector3().crossVectors(r1, v1))!;
    expect(sol.v1.distanceTo(v1)).toBeLessThan(0.01);
  });
});
