import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../game/chapters';
import { NominalFlight } from '../game/nominal';
import { Orbit } from './orbit';
import { Simulation } from './simulation';

const nominal = new NominalFlight();

describe('the partner craft', () => {
  it('stays on its own conic through the active craft touching down mid-step', () => {
    const sim = new Simulation();
    sim.restore(nominal.start(CHAPTERS.findIndex((c) => c.id === 'descent')));
    expect(sim.activeId).toBe('lm');
    sim.ship.velocity.multiplyScalar(0.97); // perilune now below the surface
    sim.perturbed();
    const csm = Orbit.fromState(sim.csm.position, sim.csm.velocity, sim.primary.mu, sim.met);
    sim.warp = 100;
    for (let i = 0; i < 10_000 && !sim.outcome; i++) sim.step(1);
    expect(sim.outcome?.kind).toBe('lost'); // 30 m/s into the Moon
    expect(sim.csm.position.distanceTo(csm.stateAt(sim.met))).toBeLessThan(1);
  });
});
