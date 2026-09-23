import { Vector3 } from 'three';
import { engineOf, predictCoast, stateOf, type Engine, type FlightState } from '../../sim/burn';
import { pointQuaternion } from '../../sim/executor';
import type { Arc } from '../../sim/coast';
import type { Simulation } from '../../sim/simulation';
import { clock, speed } from '../../ui/format';
import type { Ctx, GradeLine } from '../chapter';
import { IGNITION_GRACE } from '../director';

export const DEG = Math.PI / 180;

export function now(sim: Simulation): FlightState {
  return stateOf(sim.ship, sim.primary, sim.met);
}

export function engine(sim: Simulation): Engine {
  return engineOf(sim.ship);
}

/** The active craft's coast path from here (12 days out). */
export function coastPath(sim: Simulation): Arc[] {
  return predictCoast(now(sim), 12 * 86_400);
}

export function line(label: string, value: string, ok: boolean): GradeLine {
  return { label, value, ok };
}

/**
 * CAPCOM's running commentary for any planned burn: the intro until the
 * burn draws near, then attitude, ignition, cutoff and residual calls.
 */
export function burnSay(ctx: Ctx, intro: string): string {
  const g = ctx.guide;
  if (!g) return intro;
  const ship = ctx.sim.ship;
  const t = g.ignition - ctx.sim.met;
  const offCue = (ship.forward.angleTo(g.cue(ship)) * 180) / Math.PI;
  if (g.phase === 'paused') {
    return `RESIDUAL ${speed(g.remaining(ship), 1)} — Z TO RELIGHT AND TRIM, OR ENTER TO ACCEPT.`;
  }
  if (g.phase === 'burning') {
    const left = g.remaining(ship);
    if (left < 0) return `OVERBURN ${speed(-left, 1)} — CUT IT, X!`;
    if (left < 30) return 'COMING UP ON CUTOFF… X AT ZERO. CTRL FEATHERS THE THROTTLE.';
    return g.duration > 60 ? 'GOOD BURN. PERIOD (.) WARPS IT UP TO 10×. X TO CUT OFF AT ZERO.' : 'GOOD BURN. WATCH ΔV TO GO — X TO CUT OFF AT ZERO.';
  }
  if (t > 120) return `${intro} IGNITION IN ${clock(t)} — G WARPS THERE.`;
  if (t < -3) return `YOU'RE LATE — ${offCue > 3 ? 'ON THE ◇ AND ' : ''}LIGHT IT, Z. ${clock(IGNITION_GRACE + t)} UNTIL THE BURN IS MISSED.`;
  if (offCue > 3) return `IGNITION IN ${clock(t)}. GET ON THE ◇ CUE — WASD/QE, OR F TO HOLD IT.`;
  if (t > 5) return `ATTITUDE IS GOOD. IGNITION IN ${clock(t)} — Z TO LIGHT IT ON ZERO.`;
  return 'IGNITION — Z!';
}

/** AUTO for pilot phases: hold +Z on the cue and set the throttle. */
export function holdCue(ctx: Ctx, dir: Vector3, throttle: number): void {
  ctx.sim.hold = pointQuaternion(ctx.sim.ship, dir);
  ctx.sim.ship.throttle = throttle;
}
