import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { EARTH, RENDER_SCALE } from '../constants';

const R = EARTH.radius * RENDER_SCALE;

/** Vector-display Earth: occluding dark sphere + phosphor graticule + air glow. */
export function createPlanet(): Group {
  const group = new Group();

  // Occluder so back-side lines hide, with a hint of deep green.
  const sphere = new Mesh(
    new SphereGeometry(R * 0.998, 48, 32),
    new MeshBasicMaterial({ color: new Color('#02120a') }),
  );
  group.add(sphere);

  const dim = new LineBasicMaterial({ color: new Color('#3f9e64') });
  const bright = new LineBasicMaterial({ color: new Color('#63e094') });

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

  group.add(createAtmosphereGlow());
  return group;
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
