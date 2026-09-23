import type { Vector3 } from 'three';
import type { Maneuver } from '../sim/burn';
import type { BurnGuide } from '../sim/executor';
import type { Simulation } from '../sim/simulation';

/** What the flight director shows the pilot right now. */
export interface Cue {
  /** Attitude cue: where the engine (+Z) should point. */
  dir?: Vector3;
  /** Throttle the guidance wants (0..1). */
  throttle?: number;
  /** Entry: bank-angle magnitude the guidance wants (rad). */
  bank?: number;
  /** Δv or speed still to gain (m/s). */
  toGo?: number;
  /** Program label, e.g. "P63 BRAKING". */
  label: string;
}

/** Chapter scratch state shared by its phases, grader and CAPCOM lines. */
export interface Ctx {
  sim: Simulation;
  /** MET when the chapter began. */
  t0: number;
  /** Numbers remembered during the chapter (liftoff time, contact speed…). */
  memo: Record<string, number>;
  /** The computer flew part of it (caps the grade at ★★). */
  usedAuto: boolean;
  /** The burn being flown in the current phase, if any. */
  guide: BurnGuide | null;
}

interface PhaseBase {
  /** Short name for the HUD ("TLI", "DESCENT"). */
  name: string;
  /** CAPCOM's line for this phase. */
  say(ctx: Ctx): string;
  /** Called once when the phase begins. */
  enter?(ctx: Ctx): void;
}

/** A computer-solved burn the pilot flies (or hands to P40). */
export interface BurnPhase extends PhaseBase {
  kind: 'burn';
  /** Solve the burn; `tig` is a pilot-chosen ignition center, if dragged. */
  solve(ctx: Ctx, tig?: number): Maneuver | null;
  /** Burns smaller than this (m/s) are waived. */
  waive?: number;
}

/** Hand-flown phase against a moving guidance cue. */
export interface PilotPhase extends PhaseBase {
  kind: 'pilot';
  cue(ctx: Ctx): Cue;
  autopilot(ctx: Ctx, dt: number): void;
  done(ctx: Ctx): boolean;
  /** A moment G may warp to mid-phase (e.g. the next pass after a missed PDI). */
  next?(ctx: Ctx): number | null;
}

/** Wait for a moment in the flight (G warps straight there). */
export interface CoastPhase extends PhaseBase {
  kind: 'coast';
  until(ctx: Ctx): number;
  arrive?(ctx: Ctx): void;
}

export type Phase = BurnPhase | PilotPhase | CoastPhase;

export interface GradeLine {
  label: string;
  value: string;
  ok: boolean;
}

export interface Grade {
  stars: number;
  lines: GradeLine[];
}

export interface Chapter {
  id: string;
  title: string;
  /** One line for the chapter list. */
  summary: string;
  begin?(ctx: Ctx): void;
  phases: Phase[];
  /** A reason the chapter can't be completed any more, if so. */
  failed?(ctx: Ctx): string | null;
  finish?(ctx: Ctx): void;
  grade(ctx: Ctx): Grade;
}

/**
 * Star rating from a measured error against tolerance bands
 * [★★★, ★★, ★]; the computer flying caps it at ★★.
 */
export function starsFor(error: number, bands: [number, number, number], ctx: Ctx): number {
  const raw = error <= bands[0] ? 3 : error <= bands[1] ? 2 : error <= bands[2] ? 1 : 0;
  return ctx.usedAuto ? Math.min(2, raw) : raw;
}
