import type { Quaternion } from 'three';
import { MAX_POWERED_WARP } from '../constants';
import { magnitude, stateOf, type Maneuver } from '../sim/burn';
import { BurnGuide, pointQuaternion } from '../sim/executor';
import type { Simulation, Snapshot } from '../sim/simulation';
import type { Chapter, Ctx, Cue, Grade, Phase } from './chapter';

export type Status = 'flying' | 'complete' | 'failed';

/**
 * Runs one chapter: walks its phases, owns the current burn solution,
 * flies it when the pilot hands over (B), and grades the result.
 */
export class Director {
  readonly ctx: Ctx;
  phaseIndex = 0;
  /** Current computer solution (burn phases). */
  maneuver: Maneuver | null = null;
  guide: BurnGuide | null = null;
  /** The computer has the stick. */
  auto = false;
  status: Status = 'flying';
  failure: string | null = null;
  grade: Grade | null = null;

  constructor(
    readonly chapter: Chapter,
    readonly sim: Simulation,
    readonly start: Snapshot,
  ) {
    sim.restore(start);
    this.ctx = { sim, t0: sim.met, memo: {}, usedAuto: false, guide: null };
    chapter.begin?.(this.ctx);
    this.enter(0);
  }

  get phase(): Phase | null {
    return this.chapter.phases[this.phaseIndex] ?? null;
  }

  /** CAPCOM's current line. */
  get capcom(): string {
    if (this.status === 'failed') return this.failure ?? 'ABORT';
    return this.phase?.say(this.ctx) ?? '';
  }

  /** The guidance cue on the navball and HUD, if any. */
  get cue(): Cue | null {
    const p = this.phase;
    if (!p || this.status !== 'flying') return null;
    if (p.kind === 'pilot') return p.cue(this.ctx);
    if (p.kind === 'burn' && this.guide && this.guide.phase !== 'done') {
      return { dir: this.guide.cue(this.sim.ship), toGo: this.guide.remaining(this.sim.ship), label: p.name };
    }
    return null;
  }

  /** The next moment worth warping to (G), MET. */
  get nextEvent(): number | null {
    const p = this.phase;
    if (!p || this.status !== 'flying') return null;
    if (p.kind === 'coast') return p.until(this.ctx);
    if (p.kind === 'burn' && this.guide && this.guide.litAt === null) return this.guide.ignition - 30;
    return null;
  }

  /** Attitude that points the engine along the cue (for F hold and AUTO). */
  holdTarget(): Quaternion | null {
    const dir = this.cue?.dir;
    return dir ? pointQuaternion(this.sim.ship, dir) : null;
  }

  toggleAuto(): void {
    this.auto = !this.auto;
    if (this.auto) this.ctx.usedAuto = true;
  }

  /** Accept a paused (under-)burn and move on. */
  accept(): void {
    if (this.guide?.phase === 'paused') this.guide.accept();
  }

  /** Re-solve the current burn around a new ignition center (map drag). */
  replan(tig: number): boolean {
    const p = this.phase;
    if (p?.kind !== 'burn' || !this.guide || this.guide.litAt !== null) return false;
    const m = p.solve(this.ctx, tig);
    if (!m) return false;
    this.arm(m);
    return true;
  }

  /** Commands for this frame, before the sim steps (AUTO only). dt = real s. */
  preStep(dt: number): void {
    if (this.status !== 'flying' || !this.auto) return;
    const p = this.phase;
    const sim = this.sim;
    if (p?.kind === 'burn' && this.guide) {
      // Never light the engine mid-warp: the step would be far too long.
      const step = sim.warp > MAX_POWERED_WARP ? 0 : dt * sim.warp;
      const cmd = this.guide.autopilot(sim.ship, sim.met, step);
      sim.hold = cmd.hold;
      sim.ship.throttle = step > 0 ? cmd.throttle : 0;
    } else if (p?.kind === 'pilot') {
      p.autopilot(this.ctx, dt);
    }
  }

  /** Bookkeeping after the sim stepped: burns, phase changes, verdicts. */
  postStep(): void {
    if (this.status !== 'flying') return;
    const sim = this.sim;
    const p = this.phase;
    if (p?.kind === 'burn' && this.guide) this.guide.update(sim.ship, sim.met);

    const reason = sim.outcome?.kind === 'lost' ? sim.outcome.reason : this.chapter.failed?.(this.ctx) ?? null;
    if (reason) {
      this.status = 'failed';
      this.failure = reason;
      sim.ship.throttle = 0;
      return;
    }

    if (!p) return;
    const finished =
      (p.kind === 'burn' && (!this.guide || this.guide.phase === 'done')) ||
      (p.kind === 'coast' && sim.met >= p.until(this.ctx) - 1e-3) ||
      (p.kind === 'pilot' && p.done(this.ctx));
    if (!finished) return;
    if (p.kind === 'coast') p.arrive?.(this.ctx);
    if (p.kind === 'burn') this.endBurn();
    this.enter(this.phaseIndex + 1);
  }

  private enter(i: number): void {
    this.phaseIndex = i;
    this.maneuver = null;
    this.guide = this.ctx.guide = null;
    const p = this.phase;
    if (!p) {
      this.chapter.finish?.(this.ctx);
      this.status = 'complete';
      this.grade = this.chapter.grade(this.ctx);
      this.sim.ship.throttle = 0;
      this.sim.hold = null;
      this.auto = false;
      return;
    }
    p.enter?.(this.ctx);
    if (p.kind !== 'burn') return;
    const m = p.solve(this.ctx);
    if (!m) {
      this.status = 'failed';
      this.failure = `NO ${p.name} SOLUTION — CHECK YOUR TRAJECTORY`;
      return;
    }
    if (magnitude(m) < (p.waive ?? 0)) {
      this.sim.emit(`${p.name} NOT REQUIRED — TRAJECTORY NOMINAL`, 'good');
      this.enter(i + 1);
      return;
    }
    this.arm(m);
  }

  private arm(m: Maneuver): void {
    this.maneuver = m;
    this.guide = this.ctx.guide = new BurnGuide(m, stateOf(this.sim.ship, this.sim.primary, this.sim.met), this.sim.ship);
  }

  private endBurn(): void {
    const sim = this.sim;
    sim.ship.throttle = 0;
    if (this.auto) sim.hold = null;
    const left = this.guide ? this.guide.toGo(sim.ship).length() : 0;
    sim.emit(`${this.phase!.name} CUTOFF — RESIDUAL ${left.toFixed(1)} M/S`, left < 1 ? 'good' : 'warn');
  }
}
