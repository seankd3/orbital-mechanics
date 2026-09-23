import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Matrix4,
  Vector3,
  type Color,
} from 'three';
import { RENDER_SCALE } from '../constants';
import { VOID } from './palette';

const CELL = 5_000; // m — the patch re-centers on this lattice so lines never swim
const EXTENT = 320_000; // m — beyond the horizon from 30 km up
const FINE = 1_000; // m grid near the center
const COARSE = 10_000; // m grid out to the edge

/**
 * True-scale local surface for low flight: a finely curved occluder (the
 * body's coarse sphere is kilometers off at this range) with a ground grid
 * and a deterministic crater field. Lives in the body-fixed frame.
 */
export class SurfacePatch {
  readonly group = new Group();
  private readonly lines: LineSegments;
  private readonly ground: Mesh;
  private key = '';

  constructor(
    private readonly radius: number, // m
    color: Color,
    private readonly cratered: boolean,
  ) {
    this.ground = new Mesh(capGeometry(radius - 0.5, EXTENT), new MeshBasicMaterial({ color: VOID }));
    this.lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    this.group.add(this.ground, this.lines);
    this.group.visible = false;
  }

  /** Re-center under a body-fixed direction (unit vector). */
  update(dir: Vector3): void {
    // Snap to a lattice in (lat, lon) so the grid stays put on the ground.
    const step = CELL / this.radius;
    const lat = Math.round(Math.asin(Math.max(-1, Math.min(1, dir.y))) / step) * step;
    const lon = Math.round(Math.atan2(-dir.z, dir.x) / step) * step;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (key === this.key) return;
    this.key = key;
    // Patch frame: x east, y up, z south — so hashed craters stay put.
    const up = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const east = new Vector3(-Math.sin(lon), 0, -Math.cos(lon));
    const south = new Vector3().crossVectors(east, up);
    this.group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(east, up, south));
    this.lines.geometry.dispose();
    this.lines.geometry = this.buildLines(lat, lon);
  }

  /** Grid + craters in the patch frame (+Y = local up at the center). */
  private buildLines(lat: number, lon: number): BufferGeometry {
    const R = this.radius;
    const pts: number[] = [];
    const onSphere = (x: number, z: number) => new Vector3(x, R, z).setLength(R + 0.5).multiplyScalar(RENDER_SCALE);
    const segment = (x0: number, z0: number, x1: number, z1: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = onSphere(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
        const b = onSphere(x0 + ((x1 - x0) * (i + 1)) / n, z0 + ((z1 - z0) * (i + 1)) / n);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    };
    const grid = (spacing: number, half: number, n: number) => {
      for (let u = -half; u <= half; u += spacing) {
        segment(u, -half, u, half, n);
        segment(-half, u, half, u, n);
      }
    };
    grid(100, 1_500, 30); // touchdown scale
    grid(FINE, 12_000, 24);
    grid(COARSE, EXTENT * 0.7, 64);

    if (this.cratered) {
      // Craters hashed by body-fixed cell, so they stay put as the patch moves.
      const i0 = Math.round((lat * R) / CELL);
      const j0 = Math.round((lon * R) / CELL);
      for (let di = -16; di <= 16; di++) {
        for (let dj = -16; dj <= 16; dj++) {
          let h = hash(i0 + di, j0 + dj);
          const count = h % 3;
          for (let k = 0; k < count; k++) {
            h = hash(h, k + 17);
            const x = (dj + (h % 1000) / 1000 - 0.5) * CELL;
            const z = -(di + ((h >> 10) % 1000) / 1000 - 0.5) * CELL;
            const size = 60 + 1400 * ((h >> 20) % 1000 / 1000) ** 3;
            crater(x, z, size);
          }
        }
      }
      // Small craters near the center: what you pick a landing spot among.
      const SMALL = 250;
      const k0 = Math.round((lat * R) / SMALL);
      const l0 = Math.round((lon * R) / SMALL);
      for (let di = -10; di <= 10; di++) {
        for (let dj = -10; dj <= 10; dj++) {
          const h = hash(k0 + di + 7919, l0 + dj + 104729);
          if (h % 3 !== 0) continue;
          const x = (dj + (h % 997) / 997 - 0.5) * SMALL + (l0 * SMALL - lon * R);
          const z = -((di + ((h >> 10) % 997) / 997 - 0.5) * SMALL + (k0 * SMALL - lat * R));
          crater(x, z, 4 + 40 * (((h >> 20) % 997) / 997) ** 2);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return g;

    function crater(x: number, z: number, r: number) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const b = ((i + 1) / n) * Math.PI * 2;
        const p = onSphere(x + r * Math.cos(a), z + r * Math.sin(a));
        const q = onSphere(x + r * Math.cos(b), z + r * Math.sin(b));
        pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
      }
    }
  }
}

/** A finely tessellated spherical cap about +Y (render units). */
function capGeometry(radius: number, extent: number): BufferGeometry {
  const rings = 48;
  const segs = 96;
  const maxAngle = extent / radius;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    // Denser rings near the center, where the camera is.
    const theta = maxAngle * (i / rings) ** 2;
    for (let j = 0; j <= segs; j++) {
      const phi = (j / segs) * Math.PI * 2;
      const v = new Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).multiplyScalar(radius * RENDER_SCALE);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
}
