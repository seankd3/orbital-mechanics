import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { SHIP } from '../constants';

const FACE = new MeshBasicMaterial({ color: new Color('#010804') });
const EDGE = new LineBasicMaterial({ color: new Color('#9dffbb') });
const EDGE_DIM = new LineBasicMaterial({ color: new Color('#3f9c60') });

function edged(geometry: BufferGeometry, dim = false): Group {
  const g = new Group();
  const mesh = new Mesh(geometry, FACE);
  // Push faces back so edges never z-fight.
  mesh.renderOrder = 0;
  const edges = new LineSegments(new EdgesGeometry(geometry, 12), dim ? EDGE_DIM : EDGE);
  edges.renderOrder = 1;
  g.add(mesh, edges);
  return g;
}

export interface ShipView {
  group: Group;
  plume: Mesh;
  /** Call each frame: throttle 0..1 (0 hides the plume). */
  setPlume(level: number, elapsed: number): void;
}

/**
 * Vector-wireframe Apollo CSM, built in "ship units" (~metres), nose toward +Z,
 * scaled down to an icon so it reads at orbital camera distances.
 */
export function createShip(): ShipView {
  const ship = new Group();

  // Command module (cone) — apex forward.
  const cm = new ConeGeometry(1.9, 1.7, 12);
  cm.rotateX(Math.PI / 2);
  const cmGroup = edged(cm);
  cmGroup.position.z = 2.9;
  ship.add(cmGroup);

  // Service module (cylinder).
  const sm = new CylinderGeometry(1.9, 1.9, 3.9, 12);
  sm.rotateX(Math.PI / 2);
  ship.add(edged(sm));

  // Engine bell.
  const bell = new CylinderGeometry(0.55, 1.25, 1.5, 12, 1, true);
  bell.rotateX(Math.PI / 2);
  const bellGroup = edged(bell, true);
  bellGroup.position.z = -2.7;
  ship.add(bellGroup);

  // Exhaust plume.
  const plumeGeo = new ConeGeometry(0.9, 6, 10, 1, true);
  plumeGeo.rotateX(-Math.PI / 2); // apex toward the ship, spreading aft
  const plume = new Mesh(
    plumeGeo,
    new MeshBasicMaterial({
      color: new Color('#6fffd0'),
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  plume.position.z = -6.4;
  plume.visible = false;
  ship.add(plume);

  ship.scale.setScalar(SHIP.visualScale);

  return {
    group: ship,
    plume,
    setPlume(level: number, elapsed: number) {
      if (level <= 0) {
        plume.visible = false;
        return;
      }
      plume.visible = true;
      const flicker = 0.85 + 0.15 * Math.sin(elapsed * 47) * Math.sin(elapsed * 31);
      plume.scale.set(1, 1, (0.4 + 0.6 * level) * flicker);
      plume.position.z = -3.4 - 3 * plume.scale.z;
    },
  };
}
