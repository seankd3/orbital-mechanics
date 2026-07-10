import {
  AdditiveBlending,
  BoxGeometry,
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
  Vector3,
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
  /** LM only: hide the descent stage after staging. */
  setStaged?(staged: boolean): void;
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

  // S-IVB third stage riding behind until TLI is done.
  const sivb = new Group();
  const adapter = new CylinderGeometry(1.9, 3.3, 2.6, 12, 1, true);
  adapter.rotateX(Math.PI / 2);
  const adapterGroup = edged(adapter, true);
  adapterGroup.position.z = -4.2;
  sivb.add(adapterGroup);
  const tank = new CylinderGeometry(3.3, 3.3, 8, 12);
  tank.rotateX(Math.PI / 2);
  const tankGroup = edged(tank);
  tankGroup.position.z = -9.5;
  sivb.add(tankGroup);
  const j2 = new CylinderGeometry(0.8, 1.8, 2.2, 12, 1, true);
  j2.rotateX(Math.PI / 2);
  const j2Group = edged(j2, true);
  j2Group.position.z = -14.4;
  sivb.add(j2Group);
  ship.add(sivb);

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

  let hasBooster = true;
  return {
    group: ship,
    plume,
    setStaged(staged: boolean) {
      hasBooster = !staged;
      sivb.visible = !staged;
    },
    setPlume(level: number, elapsed: number) {
      if (level <= 0) {
        plume.visible = false;
        return;
      }
      plume.visible = true;
      const flicker = 0.85 + 0.15 * Math.sin(elapsed * 47) * Math.sin(elapsed * 31);
      const size = hasBooster ? 1.8 : 1;
      plume.scale.set(size, size, (0.4 + 0.6 * level) * flicker * size);
      const base = hasBooster ? -15.2 : -3.4;
      plume.position.z = base - 3 * plume.scale.z;
    },
  };
}

/**
 * Vector-wireframe Lunar Module: boxy ascent cabin over an octagonal descent
 * stage with four legs. +Z is "up" (engine end at −Z), so a braking descent
 * puts the legs at the surface.
 */
export function createLmView(): ShipView {
  const lm = new Group();

  // Ascent stage: cabin + docking tunnel.
  const ascent = new Group();
  const cabin = new BoxGeometry(2.4, 2.0, 1.8);
  const cabinGroup = edged(cabin);
  cabinGroup.position.z = 1.1;
  ascent.add(cabinGroup);
  const tunnel = new CylinderGeometry(0.5, 0.5, 0.6, 8);
  tunnel.rotateX(Math.PI / 2);
  const tunnelGroup = edged(tunnel, true);
  tunnelGroup.position.z = 2.3;
  ascent.add(tunnelGroup);
  lm.add(ascent);

  // Descent stage: octagonal drum + legs.
  const descent = new Group();
  const drum = new CylinderGeometry(1.7, 1.7, 1.5, 8);
  drum.rotateX(Math.PI / 2);
  const drumGroup = edged(drum);
  drumGroup.position.z = -0.8;
  descent.add(drumGroup);

  const legPts: Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const inner = new Vector3(Math.cos(a) * 1.6, Math.sin(a) * 1.6, -1.1);
    const pad = new Vector3(Math.cos(a) * 2.7, Math.sin(a) * 2.7, -2.3);
    legPts.push(inner, pad);
    // Footpad tick.
    legPts.push(pad, pad.clone().add(new Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0)));
  }
  descent.add(new LineSegments(new BufferGeometry().setFromPoints(legPts), EDGE_DIM));
  lm.add(descent);

  // Exhaust plume (repositions when the descent stage is dropped).
  const plumeGeo = new ConeGeometry(0.7, 4.5, 10, 1, true);
  plumeGeo.rotateX(-Math.PI / 2);
  const plume = new Mesh(
    plumeGeo,
    new MeshBasicMaterial({
      color: new Color('#ffd27a'),
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  plume.visible = false;
  lm.add(plume);

  lm.scale.setScalar(SHIP.visualScale);

  let stagedNow = false;
  return {
    group: lm,
    plume,
    setStaged(staged: boolean) {
      stagedNow = staged;
      descent.visible = !staged;
    },
    setPlume(level: number, elapsed: number) {
      if (level <= 0) {
        plume.visible = false;
        return;
      }
      plume.visible = true;
      const flicker = 0.85 + 0.15 * Math.sin(elapsed * 47) * Math.sin(elapsed * 31);
      plume.scale.set(1, 1, (0.4 + 0.6 * level) * flicker);
      const base = stagedNow ? 0.1 : -1.6;
      plume.position.z = base - 2.3 * plume.scale.z;
    },
  };
}
