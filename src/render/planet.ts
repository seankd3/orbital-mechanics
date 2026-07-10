import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { EARTH, RENDER_SCALE } from '../constants';

const R = EARTH.radius * RENDER_SCALE;

type Coords = [number, number][];

/** Vector-display Earth: occluding sphere + graticule + real coastlines + air glow. */
export function createPlanet(): Group {
  const group = new Group();

  // Occluder so back-side lines hide, with a hint of deep green.
  const sphere = new Mesh(
    new SphereGeometry(R * 0.997, 48, 32),
    new MeshBasicMaterial({ color: new Color('#02120a') }),
  );
  group.add(sphere);

  // With coastlines carrying the detail, the graticule recedes to scaffolding.
  const dim = new LineBasicMaterial({ color: new Color('#1e5c3a') });
  const bright = new LineBasicMaterial({ color: new Color('#2f8a55') });

  // Latitude rings every 15°.
  for (let lat = -75; lat <= 75; lat += 15) {
    const phi = (lat * Math.PI) / 180;
    const ringR = R * Math.cos(phi);
    const y = R * Math.sin(phi);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      pts.push(new Vector3(ringR * Math.cos(t), y, ringR * Math.sin(t)));
    }
    group.add(new LineLoop(new BufferGeometry().setFromPoints(pts), lat === 0 ? bright : dim));
  }

  // Longitude meridians every 15°.
  for (let lon = 0; lon < 180; lon += 15) {
    const theta = (lon * Math.PI) / 180;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const x = R * Math.cos(t);
      const y = R * Math.sin(t);
      pts.push(new Vector3(x * Math.cos(theta), y, x * Math.sin(theta)));
    }
    group.add(new Line(new BufferGeometry().setFromPoints(pts), dim));
  }

  loadCoastlines(group);
  group.add(createAtmosphereGlow());
  return group;
}

/** Natural Earth 50m coastlines as phosphor line segments, loaded async. */
function loadCoastlines(group: Group): void {
  fetch('/data/ne_50m_coastline.json')
    .then((r) => r.json())
    .then((geo: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
      const segments: number[] = [];
      for (const feature of geo.features) {
        const { type, coordinates } = feature.geometry;
        const lines: Coords[] =
          type === 'LineString' ? [coordinates as Coords] : (coordinates as Coords[]);
        for (const line of lines) {
          for (let i = 1; i < line.length; i++) {
            pushVertex(segments, line[i - 1]);
            pushVertex(segments, line[i]);
          }
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(segments), 3));
      group.add(
        new LineSegments(
          geometry,
          new LineBasicMaterial({ color: new Color('#63d98f'), transparent: true, opacity: 0.85 }),
        ),
      );
    })
    .catch(() => {
      /* graticule-only Earth still reads fine */
    });
}

function pushVertex(out: number[], [lon, lat]: [number, number]): void {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  // Slightly above the graticule shell so coastlines win the depth fight.
  const r = R * 1.0015;
  out.push(
    r * Math.cos(phi) * Math.cos(theta),
    r * Math.sin(phi),
    -r * Math.cos(phi) * Math.sin(theta),
  );
}

function createAtmosphereGlow(): Sprite {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Thin limb glow hugging the planet edge (edge sits at ~0.97 of the sprite radius).
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0.955, 'rgba(87, 230, 255, 0)');
  grad.addColorStop(0.972, 'rgba(87, 230, 255, 0.12)');
  grad.addColorStop(1, 'rgba(87, 230, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const sprite = new Sprite(
    new SpriteMaterial({
      map: new CanvasTexture(canvas),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.setScalar(R * 2.06);
  return sprite;
}
