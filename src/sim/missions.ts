import { EARTH } from '../constants';
import type { Simulation } from './simulation';

interface Mission {
  label: string;
  check: (sim: Simulation) => boolean;
}

const KM = 1000;

const MISSIONS: Mission[] = [
  {
    label: 'Raise apoapsis above 1,000 km',
    check: (sim) => sim.elements.apoapsis - EARTH.radius > 1000 * KM,
  },
  {
    label: 'Circularize above 900 km (ecc < 0.02)',
    check: (sim) =>
      sim.elements.eccentricity < 0.02 &&
      sim.elements.periapsis - EARTH.radius > 900 * KM,
  },
  {
    label: 'Deorbit: drop periapsis below 60 km',
    check: (sim) => sim.elements.periapsis - EARTH.radius < 60 * KM,
  },
  {
    label: 'Reentry: descend below 120 km',
    check: (sim) => sim.altitude < 120 * KM,
  },
];

export class MissionLog {
  private index = 0;

  get all(): { label: string; state: 'done' | 'active' | 'pending' }[] {
    return MISSIONS.map((m, i) => ({
      label: m.label,
      state: i < this.index ? 'done' : i === this.index ? 'active' : 'pending',
    }));
  }

  get allComplete(): boolean {
    return this.index >= MISSIONS.length;
  }

  reset(): void {
    this.index = 0;
  }

  /** Returns the label of a mission completed this frame, if any. */
  update(sim: Simulation): string | null {
    if (this.allComplete || sim.status === 'crashed') return null;
    const current = MISSIONS[this.index];
    if (current.check(sim)) {
      this.index++;
      return current.label;
    }
    return null;
  }
}
