import { Vector3 } from 'three';

/** A boulder in the field's tangent frame: meters east and north of the center, radius. */
export interface Boulder {
  e: number;
  n: number;
  r: number;
}

export interface TerrainSpec {
  /** Body-fixed unit vector to the field center. */
  center: number[];
  seed: number;
}

/** Footpad reach from the LM's centerline, m: a boulder inside this (plus its radius) is under a pad. */
export const FOOTPRINT = 4.5;

const CRATER = 90; // m rim radius: a football-field crater, like West crater
const DENSE = 115; // m: boulders shoulder to shoulder in and around the crater
const EXTENT = 250; // m: scattered out to nearly three crater radii

const Y = new Vector3(0, 1, 0);

/**
 * The boulder field Apollo 11's computer was steering into: a crater with
 * boulders dense inside and around it and scattered well beyond. Laid out
 * deterministically in the site's local tangent frame (east, north), so the
 * same spec always rebuilds the same rocks.
 */
export class BoulderField {
  readonly center: Vector3;
  readonly east: Vector3;
  readonly north: Vector3;
  readonly boulders: Boulder[] = [];
  readonly craterRadius = CRATER;
  readonly extent = EXTENT;

  constructor(
    center: Vector3,
    readonly radius: number, // body radius, m
    readonly seed: number,
  ) {
    this.center = center.clone().normalize();
    this.east = new Vector3().crossVectors(Y, this.center).normalize();
    this.north = new Vector3().crossVectors(this.center, this.east);
    const rand = prng(seed);
    // Jittered grids: tight in and around the crater, loose beyond.
    for (const [spacing, from, to, rMin, rMax] of [
      [9, 0, DENSE, 0.8, 2.6],
      [24, DENSE, EXTENT, 0.5, 1.6],
    ] as const) {
      for (let e = -to; e <= to; e += spacing) {
        for (let n = -to; n <= to; n += spacing) {
          const be = e + (rand() - 0.5) * spacing;
          const bn = n + (rand() - 0.5) * spacing;
          const d = Math.hypot(be, bn);
          const r = rMin + (rMax - rMin) * rand() ** 2;
          if (d >= from && d < to) this.boulders.push({ e: be, n: bn, r });
        }
      }
    }
  }

  static fromSpec(spec: TerrainSpec, radius: number): BoulderField {
    return new BoulderField(new Vector3().fromArray(spec.center), radius, spec.seed);
  }

  get spec(): TerrainSpec {
    return { center: this.center.toArray(), seed: this.seed };
  }

  /** Tangent-frame meters (east, north) of a body-fixed direction. */
  local(dir: Vector3): { e: number; n: number } {
    const u = dir.clone().normalize();
    return { e: this.radius * u.dot(this.east), n: this.radius * u.dot(this.north) };
  }

  /** Body-fixed unit vector at tangent-frame meters (east, north). */
  point(e: number, n: number): Vector3 {
    return this.center
      .clone()
      .multiplyScalar(this.radius)
      .addScaledVector(this.east, e)
      .addScaledVector(this.north, n)
      .normalize();
  }

  /** What an LM setting down here (body-fixed direction) would land on, if anything. */
  hazardAt(dir: Vector3): 'boulder' | 'crater' | null {
    const { e, n } = this.local(dir);
    const d = Math.hypot(e, n);
    if (d > EXTENT + FOOTPRINT + 3) return null;
    if (d < CRATER) return 'crater';
    return this.boulders.some((b) => Math.hypot(b.e - e, b.n - n) < b.r + FOOTPRINT) ? 'boulder' : null;
  }

  /** Nearest clear spot beyond the field along a tangent-frame heading (like flying long). */
  clearAhead(heading: { e: number; n: number }): { e: number; n: number } {
    const len = Math.hypot(heading.e, heading.n) || 1;
    const [ue, un] = [heading.e / len, heading.n / len];
    for (let d = EXTENT + FOOTPRINT; d < EXTENT * 4; d += 5) {
      const spot = { e: ue * d, n: un * d };
      if (!this.hazardAt(this.point(spot.e, spot.n))) return spot;
    }
    return { e: ue * EXTENT * 4, n: un * EXTENT * 4 };
  }
}

/** Small deterministic PRNG (mulberry32). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
