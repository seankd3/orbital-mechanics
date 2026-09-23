import { describe, expect, it } from 'vitest';
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

  it('calls a collision when the LM rams Columbia', () => {
    const sim = new Simulation();
    const d = new Director(CHAPTERS[index('rendezvous')], sim, nominal.start(index('rendezvous')));
    d.toggleAuto();
    for (let i = 0; i < 400 && d.phase?.name !== 'DOCKING' && d.status === 'flying'; i++) {
      if (!sim.ship.firing) warpNext(d);
      fly(d, 600);
    }
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
