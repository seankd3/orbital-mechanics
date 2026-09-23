import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim/simulation';
import { CHAPTERS } from './chapters';
import { autoFly, launchSnapshot } from './nominal';

/**
 * The whole Apollo 11 arc, flown chapter by chapter by the game's own
 * guidance on AUTO, each chapter starting from where the last one ended.
 */
describe('Apollo 11, end to end', () => {
  const sim = new Simulation();
  let start = launchSnapshot();

  it('opens the TLI window about 25 minutes into chapter 1', () => {
    const d = autoFly(CHAPTERS[0], new Simulation(), start, 1 / 20, 0);
    const lead = d.guide!.maneuver.tig - start.met;
    expect(lead).toBeGreaterThan(20 * 60);
    expect(lead).toBeLessThan(30 * 60);
  });

  for (const chapter of CHAPTERS) {
    it(`flies ${chapter.title} on AUTO within tolerance`, () => {
      const t0 = performance.now();
      const d = autoFly(chapter, sim, start);
      const ms = performance.now() - t0;
      const report = d.grade?.lines.map((l) => `${l.label} ${l.value}`).join(' · ');
      console.log(`${chapter.id.padEnd(11)} ${d.status} ★${d.grade?.stars ?? 0} MET ${(sim.met / 3600).toFixed(2)} h (${ms.toFixed(0)} ms) ${report ?? d.failure}`);
      expect(d.failure).toBeNull();
      expect(d.status).toBe('complete');
      expect(d.grade!.stars).toBe(2); // AUTO caps at ★★; less means out of tolerance
      start = sim.snapshot();
    });
  }

  it('splashes down', () => {
    expect(sim.outcome?.kind).toBe('splashdown');
  });
});
