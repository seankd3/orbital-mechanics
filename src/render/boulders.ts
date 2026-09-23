import { BufferGeometry, EdgesGeometry, Group, IcosahedronGeometry, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RENDER_SCALE } from '../constants';
import type { BoulderField } from '../sim/terrain';
import { lineMaterial, polyline, segments } from './lines';
import { MOON_LINE, PLAN, VOID, WARN } from './palette';

const FACE = new MeshBasicMaterial({ color: VOID, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
// Shared by every field (a restart rebuilds the rocks, not the materials).
const ROCK_EDGE = lineMaterial({ color: MOON_LINE, width: 1.1, fade: 'solid' });
const RIM = lineMaterial({ color: MOON_LINE, width: 1.25 });
const TERRACE = lineMaterial({ color: MOON_LINE, width: 1 });

/**
 * The boulder field on the ground: lumpy vector rocks (black faces that
 * occlude, edges that fade as they shrink to specks) and the crater rim.
 * Lives in the Moon's body-fixed frame; local axes x east, y up, z south.
 */
export class BoulderView {
  readonly group = new Group();

  constructor(readonly field: BoulderField) {
    const g = this.group;
    placeOnSurface(g, field.center, field.east, field.radius);
    g.scale.setScalar(RENDER_SCALE);

    const rocks: BufferGeometry[] = [];
    const edges: number[] = [];
    const features: number[] = [];
    field.boulders.forEach((b, i) => {
      const rock = lumpyRock(b.r, i);
      rock.translate(b.e, b.r * 0.3, -b.n);
      rocks.push(rock);
      const e = new EdgesGeometry(rock, 20).getAttribute('position').array;
      for (let k = 0; k < e.length; k++) edges.push(e[k]);
      // Feature = radius, not diameter: distant rocks thin out before they turn to clutter.
      for (let k = 0; k < e.length / 6; k++) features.push(b.r * RENDER_SCALE);
    });
    g.add(new Mesh(mergeGeometries(rocks), FACE));
    g.add(segments(edges, ROCK_EDGE, features));

    // The crater rim, and a second, lower terrace inside it.
    for (const [radius, material] of [[field.craterRadius, RIM], [field.craterRadius * 0.6, TERRACE]] as const) {
      const ring: Vector3[] = [];
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const wobble = 1 + 0.04 * Math.sin(a * 5 + radius) + 0.02 * Math.sin(a * 13);
        ring.push(new Vector3(Math.cos(a) * radius * wobble, 0.6, Math.sin(a) * radius * wobble));
      }
      g.add(polyline(ring, material, true));
    }
  }

  dispose(): void {
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
  }
}

/**
 * The landing point designator on the ground: an amber reticle (red while
 * it sits on hazardous ground) that keeps a steady size on screen.
 */
export class LpdReticle {
  readonly group = new Group();
  private readonly clear = lineMaterial({ color: PLAN, width: 1.5 });
  private readonly danger = lineMaterial({ color: WARN, width: 1.5 });
  private readonly marks: ReturnType<typeof segments>[] = [];

  constructor() {
    const ring: Vector3[] = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      ring.push(new Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const ticks = [1.4, 0, 0, 2.4, 0, 0, -1.4, 0, 0, -2.4, 0, 0, 0, 0, 1.4, 0, 0, 2.4, 0, 0, -1.4, 0, 0, -2.4];
    this.marks.push(polyline(ring, this.clear, true), segments(ticks, this.clear));
    this.group.add(...this.marks);
    this.group.visible = false;
  }

  /** Place at a body-fixed site; `slant` (m) sets the size so it reads the same from any range. */
  update(site: Vector3 | null, hazard: boolean, radius: number, slant: number): void {
    this.group.visible = !!site;
    if (!site) return;
    const east = new Vector3(0, 1, 0).cross(site).normalize();
    placeOnSurface(this.group, site, east, radius + 0.5);
    this.group.scale.setScalar(Math.max(4, slant * 0.012) * RENDER_SCALE);
    for (const m of this.marks) m.material = hazard ? this.danger : this.clear;
  }
}

/** Seat a group on the sphere at a body-fixed direction: x east, y up, z south. */
function placeOnSurface(g: Group, dir: Vector3, east: Vector3, radius: number): void {
  const up = dir.clone().normalize();
  const south = new Vector3().crossVectors(east, up);
  g.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(east, up, south));
  g.position.copy(up).multiplyScalar(radius * RENDER_SCALE);
}

/** A squat, irregular rock of about radius r (deterministic by index). */
function lumpyRock(r: number, seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(r, 0);
  const p = g.getAttribute('position');
  for (let k = 0; k < p.count; k++) {
    // Keyed by the corner's position, not its index: faces don't share
    // vertices here, and a shared corner must move as one.
    const key = (p.getX(k) * 12.9898 + p.getY(k) * 78.233 + p.getZ(k) * 37.719) / r;
    const h = Math.sin(key + (seed + 1) * 4.1414) * 43758.5453;
    const jitter = 0.75 + 0.5 * (h - Math.floor(h));
    p.setXYZ(k, p.getX(k) * jitter, p.getY(k) * jitter * 0.65, p.getZ(k) * jitter);
  }
  return g;
}
