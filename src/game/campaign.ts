import type { Snapshot } from '../sim/simulation';
import { CHAPTERS } from './chapters';

const KEY = 'orbital.apollo11.v4';

interface SaveData {
  /** Best stars per chapter. */
  stars: number[];
  /** Highest chapter index the pilot may fly. */
  unlocked: number;
  /** The pilot's own flight: which chapter comes next and from what state. */
  resume: { chapter: number; start: Snapshot } | null;
}

/** Campaign progress, kept in this browser only. */
export class Campaign {
  data: SaveData = { stars: CHAPTERS.map(() => 0), unlocked: 0, resume: null };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch {
      /* private mode or corrupt save: start fresh */
    }
  }

  get totalStars(): number {
    return this.data.stars.reduce((a, b) => a + b, 0);
  }

  /** A chapter was completed with `stars`; the next one opens. */
  record(chapter: number, stars: number): void {
    this.data.stars[chapter] = Math.max(this.data.stars[chapter] ?? 0, stars);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(CHAPTERS.length - 1, chapter + 1));
    this.save();
  }

  setResume(chapter: number, start: Snapshot | null): void {
    this.data.resume = start && chapter < CHAPTERS.length ? { chapter, start } : null;
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable: progress lasts this session */
    }
  }
}
