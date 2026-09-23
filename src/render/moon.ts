import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { MOON, RENDER_SCALE } from '../constants';
import { lineMaterial, segments } from './lines';
import { FAINT, MOON_LINE, VOID } from './palette';
import { graticule } from './planet';

const R = MOON.radius * RENDER_SCALE;

/** Deterministic crater field: [lat, lon, radius as a fraction of R]. */
function craters(): [number, number, number][] {
  const out: [number, number, number][] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const lat = Math.asin(rand() * 2 - 1) * (180 / Math.PI);
    const lon = rand() * 360;
    const size = 0.015 + 0.09 * rand() ** 3;
    out.push([lat, lon, size]);
  }
  return out;
}

/**
 * Vector Moon: black occluder, sparse graticule and a crater field.
 * Rotate the group by the Moon's spin so the near side faces Earth.
 */
export function createMoon(): Group {
  const group = new Group();
  group.add(new Mesh(new SphereGeometry(R * 0.998, 96, 64), new MeshBasicMaterial({ color: VOID })));
  group.add(graticule(R * 1.0002, 30, lineMaterial({ color: FAINT, width: 1, fade: true }), 15));
  const pts: number[] = [];
  const features: number[] = [];
  for (const [lat, lon, size] of craters()) {
    const before = pts.length;
    ringOnSphere(pts, R * 1.0004, lat, lon, R * size);
    for (let i = before; i < pts.length; i += 6) features.push(2 * R * size); // rim diameter
  }
  group.add(segments(pts, lineMaterial({ color: MOON_LINE, width: 1.25, opacity: 0.75, fade: true }), features));
  return group;
}

/** A small circle on a sphere (crater rim), appended as segments. */
export function ringOnSphere(out: number[], radius: number, latDeg: number, lonDeg: number, size: number, n = 28): void {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const c = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
  const east = new Vector3(-Math.sin(lon), 0, -Math.cos(lon));
  const north = new Vector3().crossVectors(c, east).normalize().negate();
  const at = (i: number) => {
    const t = (i / n) * Math.PI * 2;
    return c
      .clone()
      .multiplyScalar(radius)
      .addScaledVector(east, size * Math.cos(t))
      .addScaledVector(north, size * Math.sin(t))
      .setLength(radius);
  };
  for (let i = 0; i < n; i++) {
    const a = at(i);
    const b = at(i + 1);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}
