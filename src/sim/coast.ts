import { Vector3 } from 'three';
import { EARTH_BODY, MOON_BODY, type Body } from './bodies';
import { Orbit } from './orbit';

export type CoastEventKind = 'soi-enter' | 'soi-exit' | 'atmosphere' | 'surface';

export interface CoastEvent {
  kind: CoastEventKind;
  t: number;
}

/** One patched-conic leg: a conic about `primary`, valid over [t0, t1]. */
export interface Arc {
  primary: Body;
  orbit: Orbit;
  t0: number;
  t1: number;
  /** What ended the leg (null = prediction horizon). */
  end: CoastEventKind | null;
}

const SOI_TOLERANCE = 1e-3; // s

/**
 * The first event on `orbit` (about `primary`) in (tFrom, tTo], if any.
 * Radius events are solved analytically on the conic; lunar SOI entry is a
 * moving-target search with a step bound that cannot skip a crossing.
 */
export function nextEvent(orbit: Orbit, primary: Body, tFrom: number, tTo: number): CoastEvent | null {
  let best: CoastEvent | null = null;
  const consider = (kind: CoastEventKind, t: number | null) => {
    if (t !== null && t > tFrom && t <= tTo && (!best || t < best.t)) best = { kind, t };
  };

  const r = orbit.stateAt(tFrom).length();
  const floor = primary.radius + primary.atmosphere;
  if (primary.atmosphere > 0 && r > floor) {
    consider('atmosphere', orbit.nextRadiusCrossing(floor, tFrom, -1));
  } else if (r > primary.radius) {
    consider('surface', orbit.nextRadiusCrossing(primary.radius, tFrom, -1));
  }

  if (primary === MOON_BODY) {
    consider('soi-exit', orbit.nextRadiusCrossing(primary.soi, tFrom, 1));
  } else {
    consider('soi-enter', lunarEntryTime(orbit, tFrom, best ? (best as CoastEvent).t : tTo));
  }
  return best;
}

function lunarEntryTime(orbit: Orbit, tFrom: number, tTo: number): number | null {
  const pos = new Vector3();
  const gap = (t: number) => orbit.stateAt(t, pos).distanceTo(MOON_BODY.positionAt(t)) - MOON_BODY.soi;
  // Nothing moves faster relative to the Moon than periapsis speed + lunar speed.
  const vMax = orbit.mu / orbit.h * (1 + orbit.e) + MOON_BODY.velocityAt(0).length();

  let t = tFrom;
  let f = gap(t);
  let outside = f > 0;
  while (t < tTo) {
    const tn = Math.min(tTo, t + Math.max(30, Math.abs(f) / vMax));
    const fn = gap(tn);
    if (outside && fn <= 0) {
      let lo = t;
      let hi = tn;
      while (hi - lo > SOI_TOLERANCE) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid;
        else hi = mid;
      }
      return hi;
    }
    if (fn > 0) outside = true;
    t = tn;
    f = fn;
  }
  return null;
}

/**
 * Re-express a state in the new primary's frame after an SOI event.
 * Mutates pos/vel; returns the new primary.
 */
export function crossSoi(kind: 'soi-enter' | 'soi-exit', pos: Vector3, vel: Vector3, t: number): Body {
  const sign = kind === 'soi-enter' ? -1 : 1;
  pos.addScaledVector(MOON_BODY.positionAt(t), sign);
  vel.addScaledVector(MOON_BODY.velocityAt(t), sign);
  return kind === 'soi-enter' ? MOON_BODY : EARTH_BODY;
}

/**
 * Patched-conic coast prediction from a state until `tEnd`, the surface or
 * the atmosphere — the same arithmetic the craft flies on rails.
 */
export function predictPath(
  primary: Body,
  pos: Vector3,
  vel: Vector3,
  t0: number,
  tEnd: number,
  maxArcs = 4,
): Arc[] {
  const arcs: Arc[] = [];
  const p = pos.clone();
  const v = vel.clone();
  let t = t0;
  let body = primary;
  while (arcs.length < maxArcs && t < tEnd) {
    const orbit = Orbit.fromState(p, v, body.mu, t);
    const event = nextEvent(orbit, body, t, tEnd);
    const t1 = event ? event.t : tEnd;
    arcs.push({ primary: body, orbit, t0: t, t1, end: event?.kind ?? null });
    if (!event || event.kind === 'atmosphere' || event.kind === 'surface') break;
    orbit.stateAt(t1, p, v);
    body = crossSoi(event.kind, p, v, t1);
    t = t1;
  }
  return arcs;
}

/** Signed closest approach to the Moon along a predicted path (m from its center). */
export interface LunarPass {
  /** Periapsis radius about the Moon; sign = direction of travel around it (+ = counter-clockwise). */
  signedRadius: number;
  /** Time of the pass. */
  t: number;
  /** Whether the path actually entered the lunar SOI. */
  captured: boolean;
}

export function lunarPass(arcs: Arc[]): LunarPass | null {
  const moonArc = arcs.find((a) => a.primary === MOON_BODY);
  if (moonArc) {
    const o = moonArc.orbit;
    const t = o.nextPeriapsis(moonArc.t0) ?? moonArc.t0;
    return { signedRadius: Math.sign(o.hVec.y || 1) * o.periapsis, t, captured: true };
  }
  // No SOI entry: the closest sampled approach, signed by the side it passes on.
  const arc = arcs[0];
  if (!arc || arc.primary !== EARTH_BODY) return null;
  const end = Math.min(arc.t1, arc.t0 + (arc.orbit.closed ? arc.orbit.period : 10 * 86_400));
  const pos = new Vector3();
  const vel = new Vector3();
  let best: LunarPass | null = null;
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    const t = arc.t0 + ((end - arc.t0) * i) / steps;
    arc.orbit.stateAt(t, pos, vel);
    const rel = pos.sub(MOON_BODY.positionAt(t));
    const d = rel.length();
    if (!best || d < Math.abs(best.signedRadius)) {
      const relVel = vel.sub(MOON_BODY.velocityAt(t));
      const side = Math.sign(new Vector3().crossVectors(rel, relVel).y || 1);
      best = { signedRadius: side * d, t, captured: false };
    }
  }
  return best;
}
