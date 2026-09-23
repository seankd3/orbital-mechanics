import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { EARTH, RENDER_SCALE } from '../constants';
import { EARTH_LINE, FAINT, VOID } from './palette';

const R = EARTH.radius * RENDER_SCALE;

type Coords = [number, number][];

/** Vector Earth: black occluder, faint graticule, Natural Earth coastlines. */
export function createEarth(): Group {
  const group = new Group();
  group.add(new Mesh(new SphereGeometry(R * 0.998, 96, 64), new MeshBasicMaterial({ color: VOID })));
  // Rings sit between the parallels, so none lies in the (equatorial) orbit plane.
  group.add(graticule(R, 15, new LineBasicMaterial({ color: FAINT }), 7.5));
  loadCoastlines(group);
  return group;
}

/** Latitude rings and meridians every `step` degrees, as one segment buffer. */
export function graticule(radius: number, step: number, material: LineBasicMaterial, offset = 0): LineSegments {
  const pts: number[] = [];
  const push = (v: Vector3) => pts.push(v.x, v.y, v.z);
  const n = 128;
  for (let lat = -90 + step - offset; lat < 90; lat += step) {
    for (let i = 0; i < n; i++) {
      push(sph(radius, lat, (i / n) * 360));
      push(sph(radius, lat, ((i + 1) / n) * 360));
    }
  }
  for (let lon = 0; lon < 360; lon += step) {
    for (let i = 0; i < n / 2; i++) {
      push(sph(radius, -90 + (i / (n / 2)) * 180, lon));
      push(sph(radius, -90 + ((i + 1) / (n / 2)) * 180, lon));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return new LineSegments(g, material);
}

/** Point on a sphere: +Y north, longitude 0 on +X, east toward −Z. */
export function sph(radius: number, latDeg: number, lonDeg: number): Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon));
}

/** Natural Earth 50m coastlines as line segments, loaded async. */
function loadCoastlines(group: Group): void {
  fetch(`${import.meta.env.BASE_URL}data/ne_50m_coastline.json`)
    .then((r) => r.json())
    .then((geo: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
      const pts: number[] = [];
      for (const { geometry } of geo.features) {
        const lines: Coords[] = geometry.type === 'LineString' ? [geometry.coordinates as Coords] : (geometry.coordinates as Coords[]);
        for (const line of lines) {
          for (let i = 1; i < line.length; i++) {
            for (const [lon, lat] of [line[i - 1], line[i]]) {
              const v = sph(R * 1.0006, lat, lon);
              pts.push(v.x, v.y, v.z);
            }
          }
        }
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
      group.add(new LineSegments(g, new LineBasicMaterial({ color: EARTH_LINE })));
    })
    .catch(() => {
      /* a graticule-only Earth still reads */
    });
}
