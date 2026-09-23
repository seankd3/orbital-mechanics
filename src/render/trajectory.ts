import { Group, Vector3, type Color } from 'three';
import { RENDER_SCALE } from '../constants';
import type { Body } from '../sim/bodies';
import type { Arc } from '../sim/coast';
import { LineBuffer, lineMaterial, type VectorLineMaterial } from './lines';

const POINTS = 360;
const MAX_ARCS = 4;
const DASH: [number, number] = [9, 6]; // CSS px on screen

/**
 * A patched-conic path: each arc drawn about its primary, placed where
 * that primary will be when the craft flies it (so a lunar flyby is drawn
 * around the Moon *at encounter*, not where the Moon is now).
 */
export class Track {
  readonly group = new Group();
  private readonly lines: LineBuffer[] = [];
  private readonly material: VectorLineMaterial;
  private readonly points = new Float32Array(POINTS * 3);

  constructor(color: Color, opts: { dashed?: boolean; opacity?: number } = {}) {
    this.material = lineMaterial({ color, width: 1.5, opacity: opts.opacity, dash: opts.dashed ? DASH : undefined });
    for (let i = 0; i < MAX_ARCS; i++) {
      const line = new LineBuffer(this.material, POINTS - 1);
      this.lines.push(line);
      this.group.add(line.object);
    }
  }

  /**
   * Arcs about the body we're in are drawn about it now; arcs about a body
   * we'll meet later are drawn where it will be at the encounter.
   */
  update(arcs: Arc[] | null, now: number, current: Body, unitsPerPx = 1): void {
    if (this.material.dashed) [this.material.dashSize, this.material.gapSize] = [DASH[0] * unitsPerPx, DASH[1] * unitsPerPx];
    this.lines.forEach((line, i) => {
      const arc = arcs?.[i];
      line.object.visible = !!arc;
      if (!arc) return;
      // Vertices stay primary-relative (float32 keeps meters near the craft);
      // the anchor rides in the object's float64 transform.
      line.object.position.copy(anchorOf(arc, now, current).multiplyScalar(RENDER_SCALE));
      const pts = sampleArc(arc);
      for (let k = 0; k < POINTS; k++) {
        this.points[k * 3] = pts[k].x * RENDER_SCALE;
        this.points[k * 3 + 1] = pts[k].y * RENDER_SCALE;
        this.points[k * 3 + 2] = pts[k].z * RENDER_SCALE;
      }
      line.setPolyline(this.points);
    });
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }
}

/** Where an arc's primary is drawn (meters, Earth-centered). */
export function anchorOf(arc: Arc, now: number, current: Body): Vector3 {
  return arc.primary.positionAt(arc.primary === current ? now : Math.max(now, arc.t0));
}

/** Points along an arc (primary-relative, meters), by true anomaly. */
export function sampleArc(arc: Arc): Vector3[] {
  const o = arc.orbit;
  const nu0 = o.trueAnomalyAt(arc.t0);
  let sweep: number;
  if (o.closed && arc.t1 - arc.t0 >= o.period) {
    sweep = Math.PI * 2;
  } else {
    sweep = o.trueAnomalyAt(arc.t1) - nu0;
    if (o.closed) sweep = ((sweep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }
  if (!o.closed) {
    // Keep hyperbolic legs to a sane stretch of the asymptote.
    const limit = Math.acos(-1 / o.e) - 0.02;
    sweep = Math.min(sweep, limit - nu0);
  }
  const out: Vector3[] = [];
  for (let k = 0; k < POINTS; k++) out.push(o.stateAtTrueAnomaly(nu0 + (sweep * k) / (POINTS - 1)));
  return out;
}
