import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { MOON, RENDER_SCALE } from '../constants';

const R = MOON.radius * RENDER_SCALE;

/** Airless vector Moon: occluder + sparse gray graticule + crater rings. */
export function createMoon(): Group {
  const group = new Group();

  group.add(
    new Mesh(
      new SphereGeometry(R * 0.996, 32, 24),
      new MeshBasicMaterial({ color: new Color('#0a0d0b') }),
    ),
  );

  const mat = new LineBasicMaterial({ color: new Color('#8fae9a'), transparent: true, opacity: 0.9 });

  for (let lat = -60; lat <= 60; lat += 30) {
    const phi = (lat * Math.PI) / 180;
    const ringR = R * Math.cos(phi);
    const y = R * Math.sin(phi);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      pts.push(new Vector3(ringR * Math.cos(t), y, ringR * Math.sin(t)));
    }
    group.add(new LineLoop(new BufferGeometry().setFromPoints(pts), mat));
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const theta = (lon * Math.PI) / 180;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const x = R * Math.cos(t);
      const y = R * Math.sin(t);
      pts.push(new Vector3(x * Math.cos(theta), y, x * Math.sin(theta)));
    }
    group.add(new Line(new BufferGeometry().setFromPoints(pts), mat));
  }

  // A few named-mare-scale crater rings for character (deterministic layout).
  const craters: [number, number, number][] = [
    [10, 35, 0.16], [-8, -20, 0.1], [25, -55, 0.12], [-30, 60, 0.08],
    [45, 10, 0.07], [-15, 100, 0.13], [5, -110, 0.09], [-45, -80, 0.1],
  ];
  for (const [lat, lon, size] of craters) {
    group.add(craterRing(lat, lon, R * size, mat));
  }

  return group;
}

function craterRing(latDeg: number, lonDeg: number, radius: number, mat: LineBasicMaterial): LineLoop {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const center = new Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  );
  // Local tangent basis at the crater center.
  const east = new Vector3(-Math.sin(lon), 0, -Math.cos(lon));
  const north = new Vector3().crossVectors(center, east).normalize();

  const pts: Vector3[] = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    const p = center
      .clone()
      .multiplyScalar(R * 1.0005)
      .addScaledVector(east, radius * Math.cos(t))
      .addScaledVector(north, radius * Math.sin(t));
    pts.push(p.normalize().multiplyScalar(R * 1.0005));
  }
  return new LineLoop(new BufferGeometry().setFromPoints(pts), mat);
}
