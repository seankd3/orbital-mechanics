import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { localFrame } from '../sim/guidance';
import { Simulation } from '../sim/simulation';
import { CHAPTERS } from './chapters';
import { Director } from './director';
import { NominalFlight } from './nominal';

/**
 * Pilot-side behavior the AUTO flight never exercises: a hand-flown burn
 * earns the third star, and the ways to fail end the chapter cleanly.
 */
const DT = 1 / 30;
const nominal = new NominalFlight();
const index = (id: string) => CHAPTERS.findIndex((c) => c.id === id);

/** G: warp to the director's next event (the game eases warp; tests jump). */
function warpNext(d: Director): void {
  if (d.nextEvent === null) return;
  d.sim.warpUntil = d.nextEvent;
  d.sim.warp = 1e9;
}

function fly(d: Director, frames: number, each: (d: Director) => void = () => {}): void {
  for (let i = 0; i < frames && d.status === 'flying'; i++) {
    each(d);
    d.preStep(DT);
    d.sim.step(DT);
    d.postStep();
    d.sim.events.length = 0;
  }
}

describe('a hand-flown chapter', () => {
  it('earns three stars for a clean manual TLI (hold, light on time, cut at zero)', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('tli')], sim, nominal.start(index('tli')));
    warpNext(d); // G
    fly(d, 60 * 30, () => (sim.hold = d.holdTarget())); // F: hold the cue
    expect(sim.warpUntil).toBeNull();
    let cut = false;
    fly(d, 60 * 30 * 10, () => {
      sim.hold = d.holdTarget();
      const g = d.guide!;
      if (!g.litAt && sim.met + DT >= g.ignition) sim.ship.throttle = 1; // Z on zero
      if (g.litAt && !cut && g.remaining(sim.ship) < 0.4) {
        sim.ship.throttle = 0; // X, a human-ish 0.4 m/s early
        cut = true;
      }
      if (g.phase === 'paused') d.accept(); // ENTER: accept the residual
    });
    expect(d.status).toBe('complete');
    expect(d.ctx.usedAuto).toBe(false);
    expect(d.grade!.stars).toBe(3);
  });
});

/**
 * A human-ish pilot on the descent: Z at PDI, F on the cue, P66 sink-rate
 * clicks with a reaction lag, and (if `lpd`) LPD clicks long, one every
 * 0.3 s, while the designated site is on the boulders.
 */
function handLanding(d: Director, lpd: boolean): { clicks: number; frozen: number } {
  const sim = d.sim;
  warpNext(d);
  const seen: number[] = [];
  const lag = Math.round(0.4 / DT); // human reaction time
  let clicks = 0;
  let frozen = 0;
  for (let i = 0; i < 60 * 30 * 20 && d.status === 'flying'; i++) {
    let rodInput = 0;
    if (d.phase?.name === 'DESCENT') {
      if (!sim.ship.firing && !sim.ship.landed) sim.ship.throttle = 1; // Z at PDI
      sim.hold = d.holdTarget(); // F
      const cue = d.cue;
      if (cue?.label === 'RESTART') frozen++;
      if (lpd && cue?.hazard && i % 9 === 0) {
        d.designate({ clicks: [1, 0] }); // ↑: long
        clicks++;
      }
      const f = localFrame(sim.ship, sim.primary);
      seen.push(-f.vz);
      const sink = seen[Math.max(0, seen.length - 1 - lag)];
      const want = Math.max(0.8, Math.min(3, f.h / 20)); // sink ≈ altitude / 20
      if (d.ctx.memo.rod !== undefined) rodInput = sink > want + 0.3 ? 1 : sink < want - 0.3 ? -1 : 0;
    }
    d.preStep(DT, rodInput);
    sim.step(DT);
    d.postStep();
    sim.events.length = 0;
  }
  return { clicks, frozen };
}

describe('a hand-flown landing', () => {
  it('rides out the alarms, redesignates past the boulders and sets down softly for three stars', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    const { clicks, frozen } = handLanding(d, true);
    expect(d.ctx.memo.alarms).toBe(3); // 1202, 1202, 1201
    expect(frozen).toBeGreaterThan(0); // the restarts held the cue
    expect(clicks).toBeGreaterThanOrEqual(1); // one 2° click at high gate is ~380 m: past the field
    expect(d.status).toBe('complete');
    expect(d.grade!.lines[0].value).toBe('SOFT');
    expect(d.grade!.stars).toBe(3);
    expect(d.ctx.memo.long).toBeGreaterThan(sim.terrain!.extent);
  });

  it('lands where the pilot clicks the ground, and refuses a point behind', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    warpNext(d);
    d.toggleAuto();
    let picked: Vector3 | null = null;
    for (let i = 0; i < 60 * 30 * 20 && d.status === 'flying'; i++) {
      if (!picked && sim.terrain) {
        const field = sim.terrain;
        const here = field.local(sim.ship.position.clone().applyAxisAngle(new Vector3(0, 1, 0), -sim.primary.spinAt(sim.met)));
        expect(d.designate({ at: field.point(here.e * 1.2, here.n * 1.2) })).toMatch(/BEHIND/);
        picked = field.point(-here.e * 0.06 + 400, -here.n * 0.06); // a clear spot past the field
        expect(d.designate({ at: picked })).toMatch(/CLEAR GROUND/);
      }
      fly(d, 1);
    }
    expect(d.status).toBe('complete');
    expect(sim.ship.landedSite!.angleTo(picked!) * sim.primary.radius).toBeLessThan(40);
  });

  it('counts the fuel down to bingo while you hover', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    warpNext(d);
    d.toggleAuto();
    const calls: string[] = [];
    for (let i = 0; i < 60 * 30 * 30 && d.status === 'flying'; i++) {
      if (d.ctx.memo.lowGate && d.auto) d.toggleAuto(); // take it at low gate…
      const hovering = !d.auto;
      if (hovering) sim.hold = d.holdTarget();
      d.preStep(DT, hovering ? 1 : 0); // …and hold Shift: climb, never land
      sim.step(DT);
      d.postStep();
      for (const e of sim.events) if (/SECONDS|BINGO/.test(e.text)) calls.push(e.voice ?? e.text);
      sim.events.length = 0;
    }
    expect(calls).toEqual(['sixty-seconds', 'thirty-seconds', 'BINGO — LAND IT OR LOSE IT']);
    expect(d.status).toBe('failed'); // dry tanks at altitude
  });

  it('tips over flying the computer into the boulder field', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    handLanding(d, false);
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/TIPPED OVER/);
  });
});

describe('recovering downstream', () => {
  it('lets MCC-2 rescue a TLI cut short onto a lunar impact', () => {
    const sim = new Simulation();
    const tli = new Director(CHAPTERS[index('tli')], sim, nominal.start(index('tli')));
    warpNext(tli);
    fly(tli, 60 * 30 * 10, () => {
      sim.hold = tli.holdTarget();
      const g = tli.guide!;
      if (!g.litAt && sim.met + DT >= g.ignition) sim.ship.throttle = 1;
      if (g.litAt && g.remaining(sim.ship) < 1.5) sim.ship.throttle = 0; // 1.5 m/s short
      if (g.phase === 'paused') tli.accept();
    });
    expect(tli.status).toBe('complete');
    expect(tli.grade!.lines[0].value).toBe('LUNAR IMPACT');

    const mcc = new Director(CHAPTERS[index('mcc')], sim, sim.snapshot());
    fly(mcc, 5);
    expect(mcc.status).toBe('flying'); // not doomed before the burn
    expect(mcc.guide).not.toBeNull();
    mcc.toggleAuto();
    for (let i = 0; i < 50 && mcc.status === 'flying'; i++) {
      if (!sim.ship.firing) warpNext(mcc);
      fly(mcc, 3000);
    }
    expect(mcc.status).toBe('complete');
    expect(mcc.grade!.stars).toBe(2);
  });
});

describe('the controls around a burn', () => {
  it('restores the same TLI window late in the countdown (Backspace)', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('tli')], sim, nominal.start(index('tli')));
    const tig = d.maneuver!.tig;
    sim.warpUntil = d.guide!.ignition - 240;
    sim.warp = 1e9;
    fly(d, 1);
    expect(d.replan()).toBe(true);
    expect(d.maneuver!.tig).toBeCloseTo(tig, 0);
  });

  it('stops manual warp on the ignition countdown instead of flying past it', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('loi')], sim, nominal.start(index('loi')));
    sim.warp = 1e5;
    for (let i = 0; i < 600 && sim.warp > 1; i++) fly(d, 1);
    expect(d.status).toBe('flying');
    expect(sim.met).toBeCloseTo(d.guide!.ignition - 30, 3);
    expect(sim.warp).toBe(1);
  });

  it('lifts off early on the ascent engine and ends the wait (costing the timing star)', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('ascent')], sim, nominal.start(index('ascent')));
    expect(sim.ship.stage.name).toBe('APS');
    fly(d, 30 * 20, () => (sim.ship.throttle = 1)); // Z, hours before the window
    expect(sim.ship.landed).toBe(false);
    expect(d.phase?.name).toBe('ASCENT');
    expect(d.ctx.memo.window - d.ctx.memo.liftoff).toBeGreaterThan(600);
  });
});

describe('ways to fail', () => {
  it('impacts if the DPS is shut down at 3 km', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    warpNext(d);
    d.toggleAuto();
    fly(d, 60 * 30 * 20, () => {
      if (d.auto && d.phase?.name === 'DESCENT' && sim.altitude < 3_000) {
        d.toggleAuto();
        sim.hold = null;
      }
      if (!d.auto) sim.ship.throttle = 0;
    });
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/IMPACT/);
  });

  it('offers the next perilune when PDI is missed', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('descent')], sim, nominal.start(index('descent')));
    warpNext(d);
    fly(d, 60 * 30 * 3); // coast past PDI without lighting
    expect(d.phase?.name).toBe('DESCENT');
    expect(d.capcom).toMatch(/MISSED PDI/);
    const next = d.nextEvent!;
    expect(next - sim.met).toBeGreaterThan(3000); // about an orbit away
    warpNext(d);
    fly(d, 1);
    expect(sim.met).toBeCloseTo(next, 3);
    expect(d.capcom).not.toMatch(/MISSED PDI/); // a fresh pass: light it here
  });

  it('skips out of the atmosphere if lift stays up all the way', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('entry')], sim, nominal.start(index('entry')));
    for (let i = 0; i < 400 && d.phase?.kind !== 'pilot' && d.status === 'flying'; i++) {
      warpNext(d);
      if (d.phase?.kind === 'burn') d.toggleAuto();
      fly(d, 3000);
      if (d.auto) d.toggleAuto();
    }
    expect(d.phase?.name).toBe('ENTRY');
    fly(d, 60 * 30 * 20); // hands off: the CM stays lift-up
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/SKIPPED OUT/);
  });

  it('fails MCC once the coast no longer meets the Moon', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('mcc')], sim, nominal.start(index('mcc')));
    d.toggleAuto();
    for (let i = 0; i < 50 && d.phase?.kind !== 'coast'; i++) {
      if (!sim.ship.firing) warpNext(d);
      fly(d, 3000);
    }
    expect(d.phase?.name).toBe('TRANSLUNAR COAST');
    sim.ship.velocity.multiplyScalar(0.97); // a stray SPS firing
    sim.perturbed();
    fly(d, 1);
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/NO LUNAR ENCOUNTER/);
  });

  it('calls a missed burn instead of waiting forever for LOI', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('loi')], sim, nominal.start(index('loi')));
    const ignition = d.guide!.ignition;
    warpNext(d);
    fly(d, 30 * 60); // never light it
    expect(d.capcom).toMatch(/LATE/);
    fly(d, 30 * 200);
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/MISSED THE LOI BURN/);
    expect(sim.met - ignition).toBeLessThan(200);
  });

  it('fails entry once the return path misses the interface', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('entry')], sim, nominal.start(index('entry')));
    for (let i = 0; i < 50 && d.phase?.kind !== 'coast'; i++) {
      if (d.phase?.kind === 'burn' && !d.auto) d.toggleAuto();
      if (!sim.ship.firing) warpNext(d);
      fly(d, 3000);
    }
    expect(d.phase?.name).toBe('COAST TO ENTRY');
    sim.ship.velocity.multiplyScalar(0.999);
    sim.perturbed();
    fly(d, 1);
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/ENTRY INTERFACE/);
  });

  it('calls a collision when the LM rams Columbia', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('rendezvous')], sim, nominal.start(index('rendezvous')));
    d.toggleAuto();
    for (let i = 0; i < 400 && d.phase?.name !== 'DOCKING' && d.status === 'flying'; i++) {
      if (!sim.ship.firing) warpNext(d);
      fly(d, 600);
    }
    // Prox ops on AUTO to 150 m (braking leaves several km), then take it and ram.
    for (let i = 0; i < 60 * 30 * 30 && d.status === 'flying' && sim.relative()!.range > 150; i++) fly(d, 1);
    d.toggleAuto();
    sim.hold = null;
    fly(d, 60 * 30 * 30, () => {
      const rel = sim.relative()!;
      // Thrust straight at the target and never brake.
      const toward = rel.pos.clone().normalize().applyQuaternion(sim.ship.quaternion.clone().invert());
      sim.translation = { x: toward.x, y: toward.y, z: toward.z };
    });
    expect(d.status).toBe('failed');
    expect(d.failure).toMatch(/COLLISION/);
  });
});
