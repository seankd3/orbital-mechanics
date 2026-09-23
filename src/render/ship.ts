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
import { DIM, INK, PLAN, VOID } from './palette';

const FACE = new MeshBasicMaterial({ color: VOID, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

function edged(geometry: BufferGeometry, material: LineBasicMaterial): Group {
  const g = new Group();
  g.add(new Mesh(geometry, FACE), new LineSegments(new EdgesGeometry(geometry, 12), material));
  return g;
}

function along(geometry: BufferGeometry, z: number): BufferGeometry {
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, z);
  return geometry;
}

function plume(color: string, radius: number, length: number): Mesh {
  const geo = new ConeGeometry(radius, length, 12, 1, true);
  geo.rotateX(-Math.PI / 2); // apex at the nozzle, spreading aft
  const mesh = new Mesh(
    geo,
    new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false }),
  );
  mesh.visible = false;
  return mesh;
}

export interface CraftView {
  group: Group;
  /** Show only the stages still attached (0 = full stack). */
  setStage(dropped: number): void;
  /** Engine plume at a throttle level (0 hides it). */
  setPlume(level: number, time: number): void;
  /** Entry heating 0..1 tints the edges. */
  setHeat?(level: number): void;
  /** Parachutes: which set is out and how open (0..1). */
  setChutes?(kind: 'none' | 'drogue' | 'mains', open: number): void;
}

/**
 * Apollo CSM (+ S-IVB until TLI) in meters, nose (+Z) forward: command
 * module cone, service module, SPS bell, and the S-IVB with its J-2 behind.
 */
export function createCsm(): CraftView {
  const edge = new LineBasicMaterial({ color: INK.clone() });
  const dim = new LineBasicMaterial({ color: DIM });
  const group = new Group();

  const cm = edged(along(new ConeGeometry(1.95, 3.2, 16), 3.55), edge);
  const sm = new Group();
  sm.add(edged(along(new CylinderGeometry(1.95, 1.95, 4.0, 16), 0), edge));
  sm.add(edged(along(new CylinderGeometry(0.5, 1.2, 2.8, 16, 1, true), -3.4), dim));
  const sivb = new Group();
  sivb.add(edged(along(new CylinderGeometry(1.95, 3.3, 8.5, 16, 1, true), -6.25), dim)); // SLA
  sivb.add(edged(along(new CylinderGeometry(3.3, 3.3, 17.8, 16), -19.4), edge));
  sivb.add(edged(along(new CylinderGeometry(0.9, 1.6, 3.2, 16, 1, true), -29.9), dim));
  group.add(cm, sm, sivb);

  const flame = plume('#ffe7b0', 1.0, 9);
  const drogues = chuteSet(2, 3.5, 22, 3);
  const mains = chuteSet(3, 12, 40, 9);
  group.add(flame, drogues, mains);
  let dropped = 0;
  const baseColor = INK.clone();

  return {
    group,
    setStage(d) {
      dropped = d;
      sivb.visible = d < 1;
      sm.visible = d < 2;
    },
    setPlume(level, time) {
      flame.visible = level > 0;
      if (!level) return;
      const flicker = 0.9 + 0.1 * Math.sin(time * 53) * Math.sin(time * 31);
      const big = dropped === 0 ? 1.7 : 1;
      flame.scale.set(big, big, (0.35 + 0.65 * level) * flicker * big);
      flame.position.z = (dropped === 0 ? -31.5 : -4.8) - 4.5 * flame.scale.z;
    },
    setHeat(level) {
      edge.color.copy(baseColor).lerp(PLAN, Math.min(1, level));
    },
    setChutes(kind, open) {
      drogues.visible = kind === 'drogue';
      mains.visible = kind === 'mains';
      const set = kind === 'mains' ? mains : drogues;
      set.scale.setScalar(0.25 + 0.75 * Math.min(1, open));
    },
  };
}

/**
 * `count` canopies (wireframe domes on risers) spread around the CM's
 * apex, `height` meters above it.
 */
function chuteSet(count: number, radius: number, height: number, spread: number): Group {
  const pts: Vector3[] = [];
  const apex = new Vector3(0, 0, 5.2);
  for (let c = 0; c < count; c++) {
    const a = (c / count) * Math.PI * 2;
    const center = new Vector3(Math.cos(a) * spread, Math.sin(a) * spread, apex.z + height);
    const top = center.clone().add(new Vector3(0, 0, radius * 0.55));
    const gores = 12;
    for (let i = 0; i < gores; i++) {
      const t0 = (i / gores) * Math.PI * 2;
      const t1 = ((i + 1) / gores) * Math.PI * 2;
      const rim0 = center.clone().add(new Vector3(Math.cos(t0) * radius, Math.sin(t0) * radius, 0));
      const rim1 = center.clone().add(new Vector3(Math.cos(t1) * radius, Math.sin(t1) * radius, 0));
      pts.push(rim0, rim1, rim0, top); // rim + gore line
      if (i % 3 === 0) pts.push(rim0, apex); // risers
    }
  }
  const g = new Group();
  g.add(new LineSegments(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.8 })));
  g.visible = false;
  return g;
}

/**
 * Lunar Module in meters, +Z up (the engine fires down): boxy ascent cabin
 * with its docking tunnel over the octagonal descent stage and four legs.
 */
export function createLm(): CraftView {
  const edge = new LineBasicMaterial({ color: INK });
  const dim = new LineBasicMaterial({ color: DIM });
  const group = new Group();

  const ascent = new Group();
  const cabin = edged(new BoxGeometry(3.8, 3.2, 2.6), edge);
  cabin.position.z = 1.9;
  ascent.add(cabin, edged(along(new CylinderGeometry(0.5, 0.5, 0.8, 10), 3.6), dim));
  const descent = createDescentStage(edge, dim);
  const flame = plume('#fff0c8', 0.7, 5);
  // The sim's LM position is its footpads' contact point.
  const body = new Group();
  body.position.z = FOOT_DEPTH;
  body.add(ascent, descent, flame);
  group.add(body);
  let staged = false;
  return {
    group,
    setStage(d) {
      staged = d > 0;
      descent.visible = !staged;
    },
    setPlume(level, time) {
      flame.visible = level > 0;
      if (!level) return;
      const flicker = 0.9 + 0.1 * Math.sin(time * 47) * Math.sin(time * 29);
      flame.scale.set(1, 1, (0.35 + 0.65 * level) * flicker);
      flame.position.z = (staged ? 0.5 : -1.8) - 2.5 * flame.scale.z;
    },
  };
}

const FOOT_DEPTH = 3.0;

/** The descent stage left on the surface as the launch pad (feet at the origin). */
export function createPad(): Group {
  const g = new Group();
  const stage = createDescentStage();
  stage.position.z = FOOT_DEPTH;
  g.add(stage);
  return g;
}

/** The descent stage: octagonal drum and four legs, +Z up, feet at z = −3. */
function createDescentStage(edge = new LineBasicMaterial({ color: INK }), dim = new LineBasicMaterial({ color: DIM })): Group {
  const g = new Group();
  const drum = edged(along(new CylinderGeometry(2.1, 2.1, 1.7, 8), -0.3), edge);
  g.add(drum);
  const legs: Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const hip = new Vector3(c * 2.0, s * 2.0, 0.2);
    const pad = new Vector3(c * 4.2, s * 4.2, -3.0);
    const knee = new Vector3(c * 2.1, s * 2.1, -1.1);
    legs.push(hip, pad, knee, pad);
    legs.push(pad.clone().add(new Vector3(-s * 0.45, c * 0.45, 0)), pad.clone().add(new Vector3(s * 0.45, -c * 0.45, 0)));
  }
  g.add(new LineSegments(new BufferGeometry().setFromPoints(legs), dim));
  return g;
}
