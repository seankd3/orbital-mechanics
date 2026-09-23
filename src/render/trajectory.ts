import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Vector3,
  type Color,
} from 'three';
import { RENDER_SCALE } from '../constants';
import type { Body } from '../sim/bodies';
import type { Arc } from '../sim/coast';

const POINTS = 360;
const MAX_ARCS = 4;

/**
 * A patched-conic path: each arc drawn about its primary, placed where
 * that primary will be when the craft flies it (so a lunar flyby is drawn
 * around the Moon *at encounter*, not where the Moon is now).
 */
export class Track {
  readonly group = new Group();
  private readonly lines: Line[] = [];

  constructor(color: Color, opts: { dashed?: boolean; opacity?: number } = {}) {
    for (let i = 0; i < MAX_ARCS; i++) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(POINTS * 3), 3));
      const material = opts.dashed
        ? new LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: opts.opacity ?? 1 })
        : new LineBasicMaterial({ color, transparent: true, opacity: opts.opacity ?? 1 });
      const line = new Line(geo, material);
      line.frustumCulled = false;
      this.lines.push(line);
      this.group.add(line);
    }
  }

  /**
   * Arcs about the body we're in are drawn about it now; arcs about a body
   * we'll meet later are drawn where it will be at the encounter.
   */
  update(arcs: Arc[] | null, now: number, current: Body, dashScale = 1): void {
    this.lines.forEach((line, i) => {
      const arc = arcs?.[i];
      line.visible = !!arc;
      if (!arc) return;
      // Vertices stay primary-relative (float32 keeps meters near the craft);
      // the anchor rides in the object's float64 transform.
      line.position.copy(anchorOf(arc, now, current).multiplyScalar(RENDER_SCALE));
      const attr = line.geometry.getAttribute('position') as BufferAttribute;
      const pts = sampleArc(arc);
      for (let k = 0; k < POINTS; k++) {
        const p = pts[k];
        attr.setXYZ(k, p.x * RENDER_SCALE, p.y * RENDER_SCALE, p.z * RENDER_SCALE);
      }
      attr.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      if (line.material instanceof LineDashedMaterial) {
        line.material.dashSize = 0.6 * dashScale;
        line.material.gapSize = 0.45 * dashScale;
        line.computeLineDistances();
      }
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
