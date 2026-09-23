import { Quaternion, Vector3, type Scene } from 'three';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { EARTH, MOON, RENDER_SCALE } from '../constants';
import { EARTH_BODY, MOON_BODY } from '../sim/bodies';
import type { Arc } from '../sim/coast';
import type { Simulation } from '../sim/simulation';
import { BoulderView, LpdReticle } from './boulders';
import { isVectorLine, LineBuffer, lineMaterial, polyline } from './lines';
import { createEarth } from './planet';
import { createMoon } from './moon';
import { DIM, EARTH_LINE, FAINT, MOON_LINE, PLAN, TARGET, TRACK } from './palette';
import { createCsm, createLm, createPad } from './ship';
import { createStarfield } from './starfield';
import { SurfacePatch } from './surface';
import { Track } from './trajectory';

const Y = new Vector3(0, 1, 0);
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
/** CSM nose tip to LM origin (feet) when docked nose to nose, m. */
const DOCKED_OFFSET = 12.15;

export interface Paths {
  current: Arc[] | null;
  plan: Arc[] | null;
  partner: Arc[] | null;
}

/** Everything in the 3D scene, placed each frame from the simulation. */
export class World {
  readonly earth = createEarth();
  readonly moon = createMoon();
  readonly csm = createCsm();
  readonly lm = createLm();
  readonly pad = createPad();
  readonly track = new Track(TRACK);
  readonly plan = new Track(PLAN, { dashed: true });
  readonly partner = new Track(TARGET, { opacity: 0.55 });
  private readonly moonPatch = new SurfacePatch(MOON.radius, MOON_LINE, true);
  private readonly earthPatch = new SurfacePatch(EARTH.radius, EARTH_LINE, false);
  private readonly soi: LineSegments2;
  /** Altitude drop-line and ground reticle under a low craft. */
  private readonly drop = new LineBuffer(lineMaterial({ color: DIM, width: 1.25 }), 17);
  private readonly dropPoints = new Float32Array(17 * 6);
  private padSite: Vector3 | null = null;
  private boulders: BoulderView | null = null;
  private readonly lpd = new LpdReticle();

  constructor(scene: Scene) {
    this.moon.add(this.moonPatch.group, this.lpd.group);
    this.earth.add(this.earthPatch.group);
    const ring: Vector3[] = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      ring.push(new Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(MOON.soiRadius * RENDER_SCALE));
    }
    this.soi = polyline(ring, lineMaterial({ color: FAINT, width: 1.25 }), true);
    for (const craft of [this.csm, this.lm]) craft.group.scale.setScalar(RENDER_SCALE);
    this.pad.scale.setScalar(RENDER_SCALE);
    scene.add(
      this.earth, this.moon, this.soi, this.drop.object, this.csm.group, this.lm.group, this.pad,
      this.track.group, this.plan.group, this.partner.group, createStarfield(),
    );
  }

  /** Render-space position of a craft (Earth-centered, render units). */
  craftPosition(sim: Simulation, which: 'csm' | 'lm'): Vector3 {
    return sim.absolutePosition(sim[which]).multiplyScalar(RENDER_SCALE);
  }

  /**
   * `unitsPerPx`: map scale, render units per CSS pixel (sizes the plan's
   * dashes). `lpd`: the landing point designator's site (body-fixed), if live.
   */
  sync(sim: Simulation, paths: Paths, map: boolean, time: number, unitsPerPx: number, lpd: { site: Vector3; hazard: boolean } | null): void {
    const met = sim.met;
    const moonPos = MOON_BODY.positionAt(met).multiplyScalar(RENDER_SCALE);
    this.moon.position.copy(moonPos);
    this.moon.rotation.y = MOON_BODY.spinAt(met);
    this.earth.rotation.y = EARTH_BODY.spinAt(met);
    // The SOI ring sits where the Moon will be at encounter, if one is coming.
    const encounter = [paths.plan, paths.current].flatMap((p) => p ?? []).find((a) => a.primary === MOON_BODY && a.primary !== sim.primary);
    this.soi.position.copy(encounter ? MOON_BODY.positionAt(encounter.t0).multiplyScalar(RENDER_SCALE) : moonPos);
    this.soi.visible = map;

    // Craft.
    const csmPos = this.craftPosition(sim, 'csm');
    this.csm.group.position.copy(csmPos);
    this.csm.group.quaternion.copy(sim.csm.quaternion);
    this.csm.setStage(sim.csm.stagesDropped);
    this.csm.setPlume(sim.csm.firing ? sim.csm.throttle : 0, time);
    this.csm.setHeat?.(sim.activeId === 'csm' && sim.inAtmosphere && sim.chutes === 'none' ? Math.min(1, sim.gLoad / 5) : 0);
    this.csm.setChutes?.(sim.chutes, sim.chuteOpen);

    const lmVisible = sim.lmAlive && !(sim.docked && sim.csm.stagesDropped === 0); // inside the SLA until TLI
    this.lm.group.visible = lmVisible;
    if (lmVisible) {
      this.lm.setStage(sim.lm.landedSite ? 0 : sim.lm.stagesDropped); // on the surface it sits on its descent stage
      if (sim.docked) {
        this.lm.group.position.copy(csmPos).addScaledVector(sim.csm.forward, DOCKED_OFFSET * RENDER_SCALE);
        this.lm.group.quaternion.copy(sim.csm.quaternion).multiply(FLIP);
        this.lm.setPlume(0, time);
      } else {
        this.lm.group.position.copy(this.craftPosition(sim, 'lm'));
        this.lm.group.quaternion.copy(sim.lm.quaternion);
        this.lm.setPlume(sim.lm.firing ? sim.lm.throttle : 0, time);
      }
    }

    // The descent stage stays behind as the launch pad.
    if (sim.lm.landedSite) this.padSite = sim.lm.landedSite.clone();
    if (sim.lm.stagesDropped === 0) this.padSite = null;
    const padOn = !!this.padSite && sim.lm.stagesDropped > 0 && !sim.lm.landedSite && !map;
    this.pad.visible = padOn;
    if (padOn) {
      const up = this.padSite!.clone().applyAxisAngle(Y, MOON_BODY.spinAt(met));
      this.pad.position.copy(moonPos).addScaledVector(up, MOON.radius * RENDER_SCALE);
      this.pad.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), up);
    }

    // Low-altitude ground detail under the active craft.
    const low = !map && sim.altitude < (sim.primary === MOON_BODY ? 60_000 : 40_000);
    const patch = sim.primary === MOON_BODY ? this.moonPatch : this.earthPatch;
    const other = patch === this.moonPatch ? this.earthPatch : this.moonPatch;
    other.group.visible = false;
    patch.group.visible = low;
    if (low) {
      const fixed = sim.ship.position.clone().normalize().applyAxisAngle(Y, -sim.primary.spinAt(met));
      patch.update(fixed);
    }
    // The global line layers float kilometers off at this range: the patch takes over.
    for (const [body, near] of [[this.earth, low && patch === this.earthPatch], [this.moon, low && patch === this.moonPatch]] as const) {
      for (const child of body.children) if (isVectorLine(child)) child.visible = !near;
    }
    this.syncDropLine(sim, low && sim.altitude < 4_000 && !sim.ship.landed);
    this.syncSite(sim, low && patch === this.moonPatch, lpd);

    // Trajectories (map only): the next two legs — out and the encounter.
    for (const t of [this.track, this.plan, this.partner]) t.visible = map;
    if (map) {
      this.track.update(paths.current?.slice(0, 2) ?? null, met, sim.primary);
      this.plan.update(paths.plan?.slice(0, 2) ?? null, met, sim.primary, unitsPerPx);
      this.partner.update(paths.partner, met, sim.primary);
    }
  }

  /** The landing site: the boulder field once the computer has picked it, and the LPD. */
  private syncSite(sim: Simulation, near: boolean, lpd: { site: Vector3; hazard: boolean } | null): void {
    if (this.boulders?.field !== sim.terrain) {
      if (this.boulders) {
        this.moon.remove(this.boulders.group);
        this.boulders.dispose();
      }
      this.boulders = sim.terrain ? new BoulderView(sim.terrain) : null;
      if (this.boulders) this.moon.add(this.boulders.group);
    }
    if (this.boulders) this.boulders.group.visible = near;
    const site = near && lpd ? lpd.site : null;
    const shipFixed = sim.ship.position.clone().applyAxisAngle(Y, -sim.primary.spinAt(sim.met));
    const slant = site ? site.clone().multiplyScalar(MOON.radius).distanceTo(shipFixed) : 0;
    this.lpd.update(site, lpd?.hazard ?? false, MOON.radius, slant);
  }

  /** A plumb line from the craft to the ground with a footprint ring. */
  private syncDropLine(sim: Simulation, on: boolean): void {
    this.drop.object.visible = on;
    if (!on) return;
    const up = sim.ship.position.clone().normalize();
    const h = sim.altitude;
    this.drop.object.position.copy(this.craftPosition(sim, sim.activeId));
    const out = this.dropPoints;
    const ground = up.clone().multiplyScalar(-h);
    out.set([0, 0, 0, ground.x * RENDER_SCALE, ground.y * RENDER_SCALE, ground.z * RENDER_SCALE]);
    const a = new Vector3(1, 0, 0).cross(up).normalize();
    const b = new Vector3().crossVectors(up, a);
    const r = 4 + h * 0.02;
    for (let i = 0; i < 16; i++) {
      const t0 = (i / 16) * Math.PI * 2;
      const t1 = ((i + 1) / 16) * Math.PI * 2;
      const p0 = ground.clone().addScaledVector(a, r * Math.cos(t0)).addScaledVector(b, r * Math.sin(t0)).multiplyScalar(RENDER_SCALE);
      const p1 = ground.clone().addScaledVector(a, r * Math.cos(t1)).addScaledVector(b, r * Math.sin(t1)).multiplyScalar(RENDER_SCALE);
      out.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], 6 + i * 6);
    }
    this.drop.setSegments(out);
  }
}
