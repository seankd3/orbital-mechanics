import { Vector3 } from 'three';
import { EARTH } from '../constants';
import { EARTH_BODY } from '../sim/bodies';
import { engineOf, stateOf } from '../sim/burn';
import { Simulation, type Snapshot } from '../sim/simulation';
import { solveTli } from '../sim/targeting';
import type { Chapter } from './chapter';
import { CHAPTERS } from './chapters';
import { Director } from './director';

/** Apollo 11 was in its parking orbit about 2.5 h into the flight. */
const PARKING_MET = 2 * 3600 + 28 * 60;
const PARKING_ALTITUDE = 185_000;
/** Time from chapter start to the TLI window, s. */
const TLI_LEAD = 25 * 60;

/**
 * Chapter 1's starting point: the docked stack (CSM + LM + S-IVB) in an
 * equatorial parking orbit, phased so the TLI window opens ~25 min in.
 */
export function launchSnapshot(): Snapshot {
  const sim = new Simulation();
  const r = EARTH.radius + PARKING_ALTITUDE;
  const n = Math.sqrt(EARTH.mu / r ** 3);
  const place = (phase: number) => {
    const pos = new Vector3(r * Math.cos(phase), 0, -r * Math.sin(phase));
    const vel = new Vector3(-Math.sin(phase), 0, -Math.cos(phase)).multiplyScalar(n * r);
    sim.primary = EARTH_BODY;
    sim.met = PARKING_MET;
    sim.csm.reset(pos, vel);
    sim.lm.reset(pos, vel);
    sim.activeId = 'csm';
    sim.docked = true;
    sim.lmAlive = true;
    sim.csm.attachedMass = sim.lm.ownMass;
    sim.perturbed();
  };
  place(0);
  const tli = solveTli(stateOf(sim.ship, sim.primary, sim.met), engineOf(sim.ship), sim.met + 300);
  if (tli) place(n * (tli.tig - (PARKING_MET + TLI_LEAD))); // slide along the orbit so the window lands on time
  return sim.snapshot();
}

/**
 * Fly a chapter entirely on the computer (every phase on AUTO, coasts
 * warped straight through). The nominal chain and the tests use this.
 */
export function autoFly(chapter: Chapter, sim: Simulation, start: Snapshot, dt = 1 / 20, maxSteps = 400_000): Director {
  const d = new Director(chapter, sim, start);
  d.toggleAuto();
  for (let i = 0; i < maxSteps && d.status === 'flying'; i++) {
    const next = d.nextEvent;
    if (next !== null && sim.met < next - 0.5 && !sim.ship.firing) {
      sim.warpUntil = next;
      sim.warp = 1e9;
    }
    d.preStep(dt);
    sim.step(dt);
    d.postStep();
    sim.events.length = 0;
  }
  return d;
}

/** Nominal chapter starts: each is the computer's flight of the chapter before. */
export class NominalFlight {
  private readonly starts: Snapshot[] = [];
  private readonly sim = new Simulation();

  start(index: number): Snapshot {
    if (!this.starts.length) this.starts.push(launchSnapshot());
    while (this.starts.length <= index) {
      const i = this.starts.length - 1;
      const d = autoFly(CHAPTERS[i], this.sim, this.starts[i]);
      if (d.status !== 'complete') throw new Error(`nominal ${CHAPTERS[i].id} failed: ${d.failure}`);
      this.starts.push(this.sim.snapshot());
    }
    return this.starts[index];
  }
}
