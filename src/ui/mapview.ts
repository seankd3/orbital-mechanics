import { Vector3, type Camera } from 'three';
import { RENDER_SCALE } from '../constants';
import type { Director } from '../game/director';
import { EARTH_BODY, MOON_BODY } from '../sim/bodies';
import { coastTo, stateOf } from '../sim/burn';
import type { Arc } from '../sim/coast';
import { Orbit } from '../sim/orbit';
import type { Simulation } from '../sim/simulation';
import { Labels } from '../render/labels';
import { anchorOf } from '../render/trajectory';
import { entryAngle } from '../sim/targeting';
import { clock, degrees, km, range } from './format';

const GRAB_PX = 18;
const REPLAN_MS = 120;

/**
 * Map annotations (craft, bodies, apsides, the burn node, encounter
 * points) and the one planning gesture: drag the ◇ node along the orbit
 * and the computer re-solves the burn for the new ignition time.
 */
export class MapView {
  readonly labels: Labels;
  private drag = false;
  private pendingTig: number | null = null;
  private lastReplan = 0;
  private nodeScreen: { x: number; y: number } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly getDirector: () => Director | null,
    private readonly sim: Simulation,
    private readonly active: () => boolean,
    private readonly chase: () => boolean,
    private readonly chaseCamera: Camera,
  ) {
    this.labels = new Labels(parent);
    // Grab the ◇ label itself, or the canvas right around the node.
    const grab = (e: PointerEvent) => {
      if (!this.active() || !this.nodeScreen) return;
      const onLabel = (e.target as HTMLElement).classList?.contains('node');
      if (onLabel || Math.hypot(e.clientX - this.nodeScreen.x, e.clientY - this.nodeScreen.y) < GRAB_PX) {
        this.drag = true;
        e.preventDefault();
      }
    };
    canvas.addEventListener('pointerdown', grab);
    parent.addEventListener('pointerdown', grab);
    window.addEventListener('pointermove', (e) => {
      canvas.style.cursor = this.drag ? 'grabbing' : this.nearNode(e) ? 'grab' : '';
      if (this.drag) this.pendingTig = this.tigAt(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', () => {
      if (this.drag && this.pendingTig !== null) this.getDirector()?.replan(this.pendingTig);
      this.drag = false;
      this.pendingTig = null;
    });
  }

  private nearNode(e: PointerEvent): boolean {
    return !!this.nodeScreen && this.active() && Math.hypot(e.clientX - this.nodeScreen.x, e.clientY - this.nodeScreen.y) < GRAB_PX;
  }

  /** Ignition time under a screen point: the next pass of that true anomaly. */
  private tigAt(x: number, y: number): number | null {
    const sim = this.sim;
    const ndc = new Vector3((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0).unproject(this.camera);
    const orbit = Orbit.fromState(sim.ship.position, sim.ship.velocity, sim.primary.mu, sim.met);
    const rel = ndc.divideScalar(RENDER_SCALE).sub(sim.primary.positionAt(sim.met));
    rel.y = 0;
    const nu = Math.atan2(rel.dot(orbit.qHat), rel.dot(orbit.eHat));
    const t = orbit.timeAtTrueAnomaly(nu, sim.met + 60);
    return t === null ? null : t;
  }

  update(paths: { current: Arc[] | null; plan: Arc[] | null; partner: Arc[] | null }): void {
    const sim = this.sim;
    const cam = this.camera;
    const L = this.labels;
    L.begin();
    this.nodeScreen = null;
    if (!this.active()) {
      // Chase view: bracket the partner craft when it's close enough to matter.
      const rel = sim.relative();
      if (this.chase() && rel && rel.range < 50_000) {
        const at = sim.absolutePosition(sim.other!).multiplyScalar(RENDER_SCALE);
        L.put('chase-other', at, `${sim.activeId === 'lm' ? 'COLUMBIA' : 'EAGLE'} ${range(rel.range)}`, 'partner', this.chaseCamera);
      }
      L.end();
      return;
    }
    const d = this.getDirector();
    const R = RENDER_SCALE;
    L.put('earth', new Vector3(), 'EARTH', 'body', cam);
    L.put('moon', MOON_BODY.positionAt(sim.met).multiplyScalar(R), 'MOON', 'body', cam);
    L.put('ship', sim.absolutePosition().multiplyScalar(R), sim.activeId === 'lm' ? 'EAGLE' : 'COLUMBIA', 'craft', cam);
    if (sim.other) L.put('other', sim.absolutePosition(sim.other).multiplyScalar(R), sim.activeId === 'lm' ? 'COLUMBIA' : 'EAGLE', 'partner', cam);

    this.apsides('cur', paths.current?.[0] ?? null, sim.met);
    this.encounters('plan', paths.plan ?? paths.current, sim.met);

    // The burn node: where the planned burn is centered.
    if (d?.guide && d.guide.litAt === null && d.maneuver) {
      const tig = this.drag && this.pendingTig !== null ? this.pendingTig : d.maneuver.tig;
      const at = coastTo(stateOf(sim.ship, sim.primary, sim.met), tig);
      const world = at.primary.positionAt(at.primary === sim.primary ? sim.met : tig).add(at.pos).multiplyScalar(R);
      const el = L.put('node', world, `${d.phase?.name ?? 'BURN'}`, 'node drag', cam);
      if (el) this.nodeScreen = Labels.screen(world, cam);
      if (this.drag && this.pendingTig !== null && performance.now() - this.lastReplan > REPLAN_MS) {
        this.lastReplan = performance.now();
        d.replan(this.pendingTig);
      }
    }
    L.end();
  }

  private apsides(id: string, arc: Arc | null, now: number): void {
    if (!arc || !arc.orbit.closed) return;
    const o = arc.orbit;
    const anchor = anchorOf(arc, now, this.sim.primary);
    // Skip when the whole orbit is a dot at this zoom.
    const a = Labels.screen(anchor.clone().multiplyScalar(RENDER_SCALE), this.camera);
    const b = Labels.screen(o.stateAtTrueAnomaly(Math.PI).add(anchor).multiplyScalar(RENDER_SCALE), this.camera);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 60) return;
    const put = (key: string, nu: number, text: string) =>
      this.labels.put(`${id}-${key}`, o.stateAtTrueAnomaly(nu).add(anchor).multiplyScalar(RENDER_SCALE), text, 'apsis', this.camera);
    const R = arc.primary.radius;
    if (o.e < 0.003) {
      put('pe', Math.PI / 2, km(o.periapsis - R));
      return;
    }
    put('pe', 0, `PE ${km(o.periapsis - R, o.periapsis - R < 50e3 ? 1 : 0)}`);
    if (o.apoapsis < 5e8) put('ap', Math.PI, `AP ${km(o.apoapsis - R)}`);
  }

  /** Perilune of a lunar flyby and the entry point of a return, on a path. */
  private encounters(id: string, arcs: Arc[] | null, now: number): void {
    if (!arcs) return;
    arcs.slice(0, 2).forEach((arc, i) => {
      if (i === 0 && arc.primary === this.sim.primary) return;
      const anchor = anchorOf(arc, now, this.sim.primary);
      if (arc.primary === MOON_BODY) {
        const pe = arc.orbit.stateAtTrueAnomaly(0).add(anchor).multiplyScalar(RENDER_SCALE);
        this.labels.put(`${id}-pl${i}`, pe, `PERILUNE ${km(arc.orbit.periapsis - MOON_BODY.radius)}`, 'pass', this.camera);
        if (arc.t0 > now + 3600) {
          this.labels.put(`${id}-mo${i}`, anchor.clone().multiplyScalar(RENDER_SCALE), `MOON AT ENCOUNTER · T−${clock(arc.t0 - now)}`, 'body', this.camera);
        }
      } else if (arc.primary === EARTH_BODY && arc.end === 'atmosphere') {
        const at = arc.orbit.stateAt(arc.t1).add(anchor).multiplyScalar(RENDER_SCALE);
        this.labels.put(`${id}-ei${i}`, at, `ENTRY ${degrees(entryAngle(arc.orbit), 2)}`, 'pass', this.camera);
      }
    });
  }
}
