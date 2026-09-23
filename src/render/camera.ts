import { Vector3 } from 'three';
import { MOON, RENDER_SCALE } from '../constants';
import { MOON_BODY } from '../sim/bodies';
import type { Arc } from '../sim/coast';
import type { Simulation } from '../sim/simulation';
import type { Stage } from './stage';

export type MapFocus = 'auto' | 'earth' | 'moon';

const MIN_DIST = 15; // m
const MAX_DIST = 5e7; // m

/**
 * Chase camera that orbits the craft in its local horizon frame — "up" is
 * always away from the body below, so the horizon stays level around the
 * orbit — and a top-down map camera auto-framed on the path that matters.
 */
export class CameraRig {
  mode: 'chase' | 'map' = 'chase';
  focus: MapFocus = 'auto';
  /** Pilot's map zoom on top of the auto frame. */
  mapZoom = 1;
  /** Chase: azimuth from behind (rad), elevation (rad), distance (m). */
  az = 0.55;
  el = 0.28;
  dist = 90;
  private readonly center = new Vector3();
  private half = 20;
  private dragging = false;
  private prox = false;

  constructor(private readonly stage: Stage) {
    const canvas = stage.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'chase' && e.button === 0) {
        this.dragging = true;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointerup', () => (this.dragging = false));
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.az -= e.movementX * 0.006;
      this.el = Math.min(1.45, Math.max(-1.3, this.el + e.movementY * 0.006));
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        const f = Math.exp(Math.sign(e.deltaY) * 0.18);
        if (this.mode === 'chase') this.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, this.dist * f));
        else this.mapZoom = Math.min(40, Math.max(0.02, this.mapZoom * f));
        e.preventDefault();
      },
      { passive: false },
    );
  }

  setMode(mode: 'chase' | 'map'): void {
    this.mode = mode;
    this.stage.active = mode === 'chase' ? this.stage.chase : this.stage.map;
  }

  /** Back to the default framing: behind and above, `dist` meters out. */
  resetChase(dist = 90): void {
    this.az = 0.55;
    this.el = 0.28;
    this.dist = dist;
  }

  /** Place the chase camera around `target` (render units). */
  updateChase(sim: Simulation, target: Vector3): void {
    const ship = sim.ship;
    const up = ship.position.clone().normalize();
    // Near the partner, look past our craft at it; otherwise along the track.
    const rel = sim.relative();
    const prox = !!rel && rel.range < 3_000;
    if (prox && !this.prox) {
      // Entering prox ops: swing in behind the craft, target beyond it.
      this.az = 0.08;
      this.dist = Math.min(this.dist, 50);
    }
    this.prox = prox;
    let fwd = prox ? rel!.pos.clone() : ship.velocity.clone().addScaledVector(up, -ship.velocity.dot(up));
    if (fwd.lengthSq() < 1e-4) fwd = new Vector3(0, 1, 0).cross(up);
    fwd.normalize();
    if (prox) up.addScaledVector(fwd, -up.dot(fwd)).normalize();
    const el = prox ? Math.min(this.el, 0.12) : this.el;
    const side = new Vector3().crossVectors(fwd, up);
    const offset = fwd
      .clone()
      .multiplyScalar(-Math.cos(this.az))
      .addScaledVector(side, Math.sin(this.az))
      .multiplyScalar(Math.cos(el))
      .addScaledVector(up, Math.sin(el))
      .multiplyScalar(this.dist * RENDER_SCALE);
    const cam = this.stage.chase;
    cam.position.copy(target).add(offset);
    cam.up.copy(up);
    cam.lookAt(target);
  }

  /** Frame the map on the path that matters (smoothed). */
  updateMap(sim: Simulation, paths: (Arc[] | null)[], dt: number): void {
    const now = sim.met;
    const moon = MOON_BODY.positionAt(now).multiplyScalar(RENDER_SCALE);
    const ship = sim.absolutePosition().multiplyScalar(RENDER_SCALE);
    const arcs = paths.flatMap((p) => p?.slice(0, 2) ?? []);
    const inLunarSoi = sim.primary === MOON_BODY;
    const leaves = arcs.some((a) => a.primary !== sim.primary);
    const encounter = arcs.find((a) => a.primary === MOON_BODY && a.t0 > now);
    const aspect = window.innerWidth / window.innerHeight;
    let auto: 'earth' | 'moon' | 'system';
    if (inLunarSoi) auto = paths[1]?.some((a) => a.primary !== MOON_BODY) ? 'system' : 'moon';
    else auto = leaves || sim.orbit.apoapsis > 1e8 ? 'system' : 'earth';
    const focus = this.focus === 'auto' ? auto : this.focus;

    let center: Vector3;
    let half: number;
    if (focus === 'system') {
      // Box Earth, the Moon now and at encounter, and the craft.
      const pts = [new Vector3(), moon, ship];
      if (encounter) pts.push(MOON_BODY.positionAt(encounter.t0).multiplyScalar(RENDER_SCALE));
      const min = pts.reduce((m, p) => m.min(p), pts[0].clone());
      const max = pts.reduce((m, p) => m.max(p), pts[0].clone());
      center = min.clone().add(max).multiplyScalar(0.5);
      half = Math.max((max.z - min.z) / 2, (max.x - min.x) / 2 / aspect) * 1.25 + 30;
    } else if (focus === 'moon') {
      center = moon;
      const o = sim.orbit;
      const r = inLunarSoi ? (o.closed ? o.apoapsis : sim.ship.position.length()) : MOON.radius * 3;
      half = Math.max(MOON.radius * 1.8, Math.min(MOON.soiRadius, r) * 1.3) * RENDER_SCALE;
    } else {
      center = new Vector3();
      const o = inLunarSoi ? null : sim.orbit;
      half = Math.max(12, (o && o.closed && o.apoapsis < 1e8 ? o.apoapsis : 8e6) * 1.35 * RENDER_SCALE);
    }
    half *= this.mapZoom * 1.08;
    // Lift the content clear of the instrument strip (screen-up is −Z).
    center = center.clone().add(new Vector3(0, 0, half * 0.16));
    // Ease toward the new frame; snap on a big jump (a new chapter).
    const k = 1 - Math.exp(-dt * 5);
    if (this.center.distanceTo(center) > this.half * 3 || Math.abs(Math.log(half / this.half)) > 3) {
      this.center.copy(center);
      this.half = half;
    } else {
      this.center.lerp(center, k);
      this.half += (half - this.half) * k;
    }
    const cam = this.stage.map;
    cam.position.set(this.center.x, this.center.y + 5_000, this.center.z);
    cam.up.set(0, 0, -1);
    cam.lookAt(this.center);
    this.stage.setMapHalfHeight(this.half);
  }
}
