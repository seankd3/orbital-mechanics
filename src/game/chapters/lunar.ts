import { Vector3 } from 'three';
import { MOON } from '../../constants';
import { stateOf } from '../../sim/burn';
import { pointQuaternion } from '../../sim/executor';
import { ascentGuidance, descentGuidance, dockingGuidance, localFrame } from '../../sim/guidance';
import { Orbit } from '../../sim/orbit';
import type { Simulation } from '../../sim/simulation';
import { solveBraking, solveIntercept, solveOppositeApsis, TARGET } from '../../sim/targeting';
import { clock, km, range, speed } from '../../ui/format';
import { starsFor, type Chapter, type Ctx } from '../chapter';
import { burnSay, engine, holdCue, line, now } from './common';

const R = MOON.radius;
const Y = new Vector3(0, 1, 0);

// --- undock & DOI --------------------------------------------------------------

export const DOI: Chapter = {
  id: 'doi',
  title: 'UNDOCK & DESCENT ORBIT',
  summary: 'Eagle has wings. Drop perilune to 15 km for the landing.',
  begin(ctx) {
    ctx.sim.undock(0.3);
    ctx.sim.emit('UNDOCKED — THE EAGLE HAS WINGS', 'good');
  },
  phases: [
    {
      kind: 'burn',
      name: 'DOI',
      solve: (ctx, tig) => solveOppositeApsis(now(ctx.sim), engine(ctx.sim), tig ?? ctx.t0 + 20 * 60, TARGET.descentPerilune),
      say: (ctx) => burnSay(ctx, "EAGLE, YOU'RE GO FOR DOI. A SMALL RETRO BURN — PERILUNE 15 KM, HALF AN ORBIT AHEAD."),
    },
  ],
  failed: (ctx) => {
    if (ctx.sim.ship.firing) return null;
    return ctx.sim.orbit.periapsis < R + 4_000 ? 'PERILUNE UNDER 4 KM — EAGLE WOULD HIT THE MOUNTAINS' : null;
  },
  grade(ctx) {
    const pe = ctx.sim.orbit.periapsis - R;
    const err = Math.abs(ctx.sim.orbit.periapsis - TARGET.descentPerilune);
    return {
      stars: starsFor(err, [1e3, 4e3, 12e3], ctx),
      lines: [line('PERILUNE', km(pe, 1), err < 4e3), line('TARGET', km(TARGET.descentPerilune - R, 1), true)],
    };
  },
};

// --- powered descent -------------------------------------------------------------

export const DESCENT: Chapter = {
  id: 'descent',
  title: 'POWERED DESCENT',
  summary: 'Fly the descent cue from 15 km to contact light.',
  phases: [
    {
      kind: 'coast',
      name: 'COAST TO PDI',
      until: (ctx) => (ctx.memo.pdi ??= ctx.sim.orbit.nextPeriapsis(ctx.sim.met) ?? ctx.sim.met),
      say: (ctx) => `EAGLE, YOU'RE GO FOR POWERED DESCENT. PDI AT PERILUNE IN ${clock((ctx.memo.pdi ?? 0) - ctx.sim.met)} — G WARPS THERE.`,
    },
    {
      kind: 'pilot',
      name: 'DESCENT',
      enter: (ctx) => ctx.sim.emit('PDI — THROTTLE UP (Z)', 'warn'),
      cue: (ctx) => {
        const c = descentGuidance(ctx.sim.ship, ctx.sim.primary);
        return { dir: c.dir, throttle: c.throttle, label: c.phase };
      },
      autopilot(ctx) {
        const c = descentGuidance(ctx.sim.ship, ctx.sim.primary);
        holdCue(ctx, c.dir, c.throttle);
      },
      done: (ctx) => ctx.sim.ship.landed,
      say: (ctx) => descentCall(ctx.sim),
    },
  ],
  finish(ctx) {
    const c = ctx.sim.lastContact!;
    ctx.memo.vs = c.verticalSpeed;
    ctx.memo.hs = c.horizontalSpeed;
    ctx.memo.fuel = ctx.sim.ship.fuelFraction;
    ctx.sim.emit('HOUSTON, TRANQUILITY BASE HERE. THE EAGLE HAS LANDED.', 'good');
  },
  grade(ctx) {
    const { vs, hs, fuel } = ctx.memo;
    const severity = Math.max(vs / 1.5, hs / 1.0); // ≤1 soft, ≤2 firm
    const raw = severity <= 1 ? 3 : severity <= 2 ? 2 : 1;
    return {
      stars: ctx.usedAuto ? Math.min(2, raw) : raw,
      lines: [
        line('CONTACT', raw === 3 ? 'SOFT' : raw === 2 ? 'FIRM' : 'HARD', raw >= 2),
        line('SINK RATE', speed(vs, 1), vs <= 1.5),
        line('DRIFT', speed(hs, 1), hs <= 1),
        line('DPS PROPELLANT', `${Math.round(fuel * 100)}%`, fuel > 0.05),
      ],
    };
  },
};

function descentCall(sim: Simulation): string {
  const ship = sim.ship;
  const f = localFrame(ship, sim.primary);
  const cue = descentGuidance(ship, sim.primary);
  const seconds = ship.fuel / (ship.stage.thrust / ship.exhaustVelocity) / Math.max(ship.throttle, 0.3);
  if (!ship.firing && f.h > 1_000) return 'LIGHT THE DPS — Z — AND FOLLOW THE ◇. THE THROTTLE BUG ▸ ON THE BAR IS WHAT GUIDANCE WANTS.';
  if (ship.fuelFraction < 0.05) return `${Math.round(seconds)} SECONDS. GET IT DOWN.`;
  if (cue.phase === 'P66 LAND') {
    return f.h > 30
      ? `P66. ${Math.round(f.h)} M, DOWN ${speed(-f.vz, 1)}, DRIFT ${speed(f.vh, 1)}. EASE IT DOWN — SHIFT/CTRL.`
      : `${Math.round(f.h)} M… ${speed(-f.vz, 1)} DOWN… PICKING UP SOME DUST.`;
  }
  if (cue.phase === 'P64 APPROACH') return `P64 PITCHOVER. ${km(f.h, 1)}. KEEP IT ON THE CUE.`;
  return `P63 BRAKING. ${km(f.h, 1)}, ${speed(f.vh)} ACROSS THE GROUND. YOU'RE GO.`;
}

// --- ascent ---------------------------------------------------------------------

/** Insertion target: 18 km perilune under an 83 km apolune (Apollo 11: 17 × 83 km). */
const INSERTION = (() => {
  const rf = R + 18_000;
  const a = (rf + R + 83_000) / 2;
  return { radius: rf, speed: Math.sqrt(MOON.mu * (2 / rf - 1 / a)) };
})();

/** CSM lead angle over the LM at liftoff that sets up TPI about an orbit later. */
export const ASCENT_LEAD = 0.1; // rad

/** First MET after `t` at which the CSM leads the landed LM by ASCENT_LEAD. */
function liftoffWindow(sim: Simulation): number {
  const csm = stateOf(sim.csm, sim.primary, sim.met);
  const orbit = Orbit.fromState(csm.pos, csm.vel, csm.primary.mu, csm.t);
  const site = sim.lm.landedSite!;
  const lead = (t: number) => {
    const c = orbit.stateAt(t);
    const lm = site.clone().applyAxisAngle(Y, sim.primary.spinAt(t));
    const h = orbit.hVec.clone().normalize();
    return Math.atan2(new Vector3().crossVectors(lm, c).dot(h), lm.dot(c));
  };
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  let prev = wrap(lead(sim.met + 600) - ASCENT_LEAD);
  for (let t = sim.met + 630; t < sim.met + 3 * orbit.period; t += 30) {
    const cur = wrap(lead(t) - ASCENT_LEAD);
    if (prev < 0 && cur >= 0) {
      let lo = t - 30;
      let hi = t;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (wrap(lead(mid) - ASCENT_LEAD) < 0) lo = mid;
        else hi = mid;
      }
      return Math.round(hi);
    }
    prev = cur;
  }
  return sim.met + 600;
}

function csmNormal(sim: Simulation): Vector3 {
  return new Vector3().crossVectors(sim.csm.position, sim.csm.velocity).normalize();
}

export const ASCENT: Chapter = {
  id: 'ascent',
  title: 'LUNAR ASCENT',
  summary: 'Leave the descent stage behind and chase Columbia into orbit.',
  begin(ctx) {
    ctx.memo.window = liftoffWindow(ctx.sim);
  },
  phases: [
    {
      kind: 'coast',
      name: 'LIFTOFF WINDOW',
      until: (ctx) => ctx.memo.window - 20,
      say: (ctx) =>
        `EVA COMPLETE. COLUMBIA IS COMING AROUND — YOUR LIFTOFF WINDOW IS IN ${clock(ctx.memo.window - ctx.sim.met)}. G TO WARP.`,
    },
    {
      kind: 'pilot',
      name: 'ASCENT',
      enter: (ctx) => {
        ctx.sim.ship.dropStage();
        ctx.sim.emit('ASCENT STAGE ARMED — DESCENT STAGE STAYS AS THE LAUNCH PAD', 'info');
      },
      cue: (ctx) => {
        const c = ascentGuidance(ctx.sim.ship, ctx.sim.primary, csmNormal(ctx.sim), INSERTION);
        return { dir: c.dir, throttle: c.toGo > 0 ? 1 : 0, toGo: c.toGo, label: c.phase };
      },
      autopilot(ctx, dt) {
        const sim = ctx.sim;
        const c = ascentGuidance(sim.ship, sim.primary, csmNormal(sim), INSERTION);
        const accel = sim.ship.stage.thrust / sim.ship.mass;
        const step = dt * Math.min(sim.warp, 10);
        const throttle = sim.ship.landed && sim.met + step < ctx.memo.window ? 0 : Math.min(1, Math.max(0, c.toGo) / (accel * step));
        holdCue(ctx, c.dir, throttle);
      },
      done: (ctx) => {
        const sim = ctx.sim;
        if (sim.ship.landed) return false;
        if (ctx.memo.liftoff === undefined) ctx.memo.liftoff = sim.met;
        const c = ascentGuidance(sim.ship, sim.primary, csmNormal(sim), INSERTION);
        return !sim.ship.firing && c.toGo < 2 && sim.orbit.periapsis > R + 5_000;
      },
      say: (ctx) => {
        const sim = ctx.sim;
        const t = ctx.memo.window - sim.met;
        if (sim.ship.landed) return t > 0 ? `LIFTOFF IN ${Math.ceil(t)} — Z ON ZERO, THEN RIDE THE ◇.` : 'LIFTOFF — Z! THE WINDOW IS OPEN.';
        const c = ascentGuidance(sim.ship, sim.primary, csmNormal(sim), INSERTION);
        if (!sim.ship.firing && c.toGo > 2) return `APS OFF WITH ${speed(c.toGo)} TO GO — RELIGHT, Z!`;
        return c.toGo < 60 ? `${speed(c.toGo)} TO GO — X ON ZERO FOR INSERTION.` : `${c.phase}. FOLLOW THE ◇. ${speed(c.toGo)} TO ORBIT.`;
      },
    },
  ],
  grade(ctx) {
    const o = ctx.sim.orbit;
    const pe = o.periapsis - R;
    const ap = o.apoapsis - R;
    const late = Math.abs((ctx.memo.liftoff ?? ctx.memo.window) - ctx.memo.window);
    const orbitErr = Math.max(Math.max(0, 15e3 - pe) * 5, Math.abs(ap - 83e3));
    const raw = Math.min(starsFor(orbitErr, [25e3, 60e3, 200e3], ctx), late < 15 ? 3 : late < 60 ? 2 : 1);
    return {
      stars: raw,
      lines: [
        line('INSERTION ORBIT', `${km(pe)} × ${km(ap)}`, orbitErr < 25e3),
        line('LIFTOFF', late < 1 ? 'ON TIME' : `${Math.round(late)} S OFF`, late < 15),
        line('APS PROPELLANT', `${Math.round(ctx.sim.ship.fuelFraction * 100)}%`, true),
      ],
    };
  },
};

// --- rendezvous & docking ---------------------------------------------------------

const TRANSFER = 2400; // s, TPI → intercept
const CAPTURE_RANGE = 15; // m
const CAPTURE_SPEED = 1; // m/s — faster than this is a collision

function target(sim: Simulation) {
  return stateOf(sim.csm, sim.primary, sim.met);
}

export const RENDEZVOUS: Chapter = {
  id: 'rendezvous',
  title: 'RENDEZVOUS & DOCKING',
  summary: 'Intercept Columbia, brake, and fly the last hundred meters on RCS.',
  begin(ctx) {
    ctx.memo.rcs0 = ctx.sim.lm.rcsFuel;
  },
  phases: [
    {
      kind: 'burn',
      name: 'TPI',
      solve(ctx) {
        const plan = solveIntercept(now(ctx.sim), target(ctx.sim), TRANSFER);
        if (plan) ctx.memo.arrival = plan.arrival;
        return plan?.tpi ?? null;
      },
      say: (ctx) => burnSay(ctx, 'EAGLE, COLUMBIA IS AHEAD AND ABOVE. TPI PUTS YOU ON AN INTERCEPT — 40 MINUTES TO CLOSE.'),
    },
    {
      kind: 'burn',
      name: 'BRAKING',
      solve: (ctx) => solveBraking(now(ctx.sim), target(ctx.sim), (ctx.memo.arrival ?? ctx.sim.met) - ctx.sim.met + 900),
      say: (ctx) => burnSay(ctx, 'ON THE INTERCEPT. THE BRAKING BURN MATCHES COLUMBIA AT CLOSEST APPROACH.'),
    },
    {
      kind: 'pilot',
      name: 'DOCKING',
      enter: (ctx) => void (ctx.memo.prox = 1),
      cue: (ctx) => {
        const rel = ctx.sim.relative();
        return { dir: rel?.pos.clone().normalize(), label: 'PROX OPS' };
      },
      autopilot(ctx) {
        const sim = ctx.sim;
        const g = dockingGuidance(sim);
        const rel = sim.relative();
        if (!g || !rel) return;
        sim.hold = pointQuaternion(sim.ship, rel.pos);
        sim.translation = g.translation;
        sim.ship.throttle = 0;
      },
      done: (ctx) => {
        const sim = ctx.sim;
        const rel = sim.relative();
        if (!rel || rel.range > CAPTURE_RANGE || -rel.rangeRate >= CAPTURE_SPEED) return false;
        ctx.memo.contact = Math.max(0, -rel.rangeRate);
        ctx.memo.rcsUsed = 1 - sim.lm.rcsFuel / ctx.memo.rcs0;
        sim.translation = { x: 0, y: 0, z: 0 };
        sim.dock(true);
        sim.emit('CAPTURE — HARD DOCK. CREW TRANSFER; EAGLE JETTISONED.', 'good');
        return true;
      },
      say: (ctx) => {
        const rel = ctx.sim.relative();
        if (!rel) return '';
        const closing = -rel.rangeRate;
        const limit = Math.min(6, Math.max(0.25, rel.range / 60));
        const call = closing > limit * 1.5 ? 'TOO FAST — BRAKE WITH K.' : closing < 0 ? 'OPENING — CLOSE WITH I.' : 'GOOD RATE.';
        return `RANGE ${range(rel.range)}, CLOSING ${speed(closing, 2)}. ${call} I/K CLOSE, J/L U/O NULL DRIFT. CAPTURE UNDER ${CAPTURE_SPEED} M/S.`;
      },
    },
  ],
  failed: (ctx) => {
    const rel = ctx.sim.relative();
    if (ctx.memo.prox && rel && rel.range < CAPTURE_RANGE && -rel.rangeRate >= CAPTURE_SPEED) {
      return `COLLISION AT ${speed(-rel.rangeRate, 1)} — DOCKING PROBE DAMAGED`;
    }
    return null;
  },
  grade(ctx) {
    const { contact, rcsUsed } = ctx.memo;
    return {
      stars: Math.min(starsFor(contact, [0.3, 0.6, CAPTURE_SPEED], ctx), rcsUsed < 0.6 ? 3 : 2),
      lines: [
        line('CONTACT SPEED', speed(contact, 2), contact <= 0.3),
        line('RCS USED', `${Math.round(rcsUsed * 100)}%`, rcsUsed < 0.6),
      ],
    };
  },
};
