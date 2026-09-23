import { Vector3 } from 'three';
import { MOON } from '../../constants';
import { descentGuidance, HIGH_GATE, localFrame, naturalSite, type PoweredCue } from '../../sim/guidance';
import type { Simulation } from '../../sim/simulation';
import { BoulderField } from '../../sim/terrain';
import { clock, km, range, speed } from '../../ui/format';
import type { Chapter, Ctx, Designation } from '../chapter';
import { holdCue, line } from './common';

const R = MOON.radius;
const Y = new Vector3(0, 1, 0);

/** Apollo 11's executive overflows, by altitude on this descent: 1202, 1202, 1201. */
const ALARMS: [number, number][] = [
  [10_000, 1202],
  [7_000, 1202],
  [900, 1201],
];
/** Seconds the computer is busy restarting: the cue and auto-throttle hold still. */
const RESTART = 1.5;
/** Seconds of alarm chatter on the loop. */
const ALARM_TALK = 8;
/** At bingo there are this many seconds of hover left: land or abort. */
export const BINGO_RESERVE = 20;
/** The fuel calls, in seconds to bingo. */
const FUEL_CALLS = [60, 30, 0];
/** Eagle had 45–50 s of propellant left at contact (post-flight analysis). */
const EAGLE_HOVER = 45;
/** One LPD click moves the site 2° of look angle. */
const LPD_CLICK = (2 * Math.PI) / 180;
/** How far from the computer's site the approach can be redesignated, m. */
const LPD_REACH = 2_000;
const FIELD_SEED = 1969;

/**
 * Powered descent, the way Apollo 11 flew it: P63 braking with program
 * alarms on the way down, high gate where the computer commits to a site
 * (a boulder field), P64 with the landing point designator, and P66 by
 * hand to contact light, against the fuel calls.
 */
export const DESCENT: Chapter = {
  id: 'descent',
  title: 'POWERED DESCENT',
  summary: 'Fly the descent cue from 15 km to contact light — and not onto the boulders.',
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
      enter: (ctx) => {
        ctx.memo.pdiFuel = ctx.sim.ship.fuel;
        ctx.sim.emit('PDI — THROTTLE UP (Z)', 'warn');
      },
      cue: (ctx) => {
        const c = command(ctx);
        const m = ctx.memo;
        const site = m.lowGate ? null : siteDir(ctx);
        return {
          dir: c.dir,
          throttle: c.throttle,
          label: c.phase,
          alarm: alarmTalking(ctx) ? String(m.alarmCode) : undefined,
          site: site ?? undefined,
          hazard: site ? !!ctx.sim.terrain!.hazardAt(site) : undefined,
        };
      },
      autopilot(ctx) {
        const sim = ctx.sim;
        const site = ctx.memo.lowGate ? null : siteDir(ctx);
        // The computer can't see boulders; on AUTO the crew still looks out
        // of the window, and takes it long past the field, as Armstrong did.
        if (site && sim.terrain!.hazardAt(site)) {
          const spot = sim.terrain!.clearAhead(heading(ctx));
          ctx.memo.siteE = spot.e;
          ctx.memo.siteN = spot.n;
        }
        const c = command(ctx);
        holdCue(ctx, c.dir, c.throttle);
      },
      assist: descentAssist,
      tick: descentTick,
      designate,
      done: (ctx) => ctx.sim.ship.landed,
      next: (ctx) => (missedPdi(ctx) ? (ctx.sim.orbit.nextPeriapsis(ctx.sim.met) ?? ctx.sim.met) - 20 : null),
      say: (ctx) => (missedPdi(ctx) ? 'EAGLE, YOU MISSED PDI. G TAKES YOU AROUND TO THE NEXT PERILUNE — LIGHT IT THERE.' : descentCall(ctx)),
    },
  ],
  finish(ctx) {
    const sim = ctx.sim;
    const c = sim.lastContact!;
    ctx.memo.vs = c.verticalSpeed;
    ctx.memo.hs = c.horizontalSpeed;
    ctx.memo.hover = hoverSeconds(sim);
    const field = sim.terrain;
    if (field && sim.ship.landedSite) {
      const { e, n } = field.local(sim.ship.landedSite);
      ctx.memo.long = Math.hypot(e, n);
    }
    sim.emit('HOUSTON, TRANQUILITY BASE HERE. THE EAGLE HAS LANDED.', 'good');
  },
  grade(ctx) {
    const { vs, hs, hover, long } = ctx.memo;
    const severity = Math.max(vs / 1.5, hs / 1.0); // ≤1 soft, ≤2 firm
    let raw = severity <= 1 ? 3 : severity <= 2 ? 2 : 1;
    if (hover < BINGO_RESERVE) raw = Math.min(raw, 2); // past bingo isn't a clean landing
    return {
      stars: ctx.usedAuto ? Math.min(2, raw) : raw,
      lines: [
        line('CONTACT', severity <= 1 ? 'SOFT' : severity <= 2 ? 'FIRM' : 'HARD', severity <= 2),
        line('SINK RATE', speed(vs, 1), vs <= 1.5),
        line('DRIFT', speed(hs, 1), hs <= 1),
        line('PROPELLANT', `${Math.round(hover)} S OF HOVER · EAGLE HAD ~${EAGLE_HOVER}`, hover >= BINGO_RESERVE),
        ...(long !== undefined ? [line("FROM THE COMPUTER'S SITE", range(long), true)] : []),
      ],
    };
  },
};

// --- guidance, shared by the cue, AUTO and the auto-throttle ------------------------

/** The designated site, body-fixed unit vector (null before high gate). */
function siteDir(ctx: Ctx): Vector3 | null {
  const field = ctx.sim.terrain;
  return field && ctx.memo.siteE !== undefined ? field.point(ctx.memo.siteE, ctx.memo.siteN) : null;
}

/** The descent guidance this frame: P64 flies to the designated site; a restarting computer holds its last command. */
function command(ctx: Ctx): PoweredCue {
  const sim = ctx.sim;
  const m = ctx.memo;
  if (m.freezeUntil !== undefined && sim.met < m.freezeUntil) {
    return { dir: new Vector3(m.frozenX, m.frozenY, m.frozenZ), throttle: m.frozenThrottle, phase: 'RESTART', tgo: 0 };
  }
  const dir = m.lowGate ? null : siteDir(ctx);
  const site = dir?.applyAxisAngle(Y, sim.primary.spinAt(sim.met)).multiplyScalar(R);
  return descentGuidance(sim.ship, sim.primary, site);
}

/** Seconds of hover the DPS has left (thrust = weight). */
export function hoverSeconds(sim: Simulation): number {
  const ship = sim.ship;
  const g = sim.primary.mu / ship.position.lengthSq();
  return (ship.fuel * ship.exhaustVelocity) / (g * ship.mass);
}

function alarmTalking(ctx: Ctx): boolean {
  return ctx.memo.alarmAt !== undefined && ctx.sim.met - ctx.memo.alarmAt < ALARM_TALK;
}

/** Surface-relative heading of the LM in the field's frame (east, north). */
function heading(ctx: Ctx): { e: number; n: number } {
  const sim = ctx.sim;
  const v = localFrame(sim.ship, sim.primary).vhVec.applyAxisAngle(Y, -sim.primary.spinAt(sim.met));
  const field = sim.terrain!;
  const e = v.dot(field.east);
  const n = v.dot(field.north);
  const len = Math.hypot(e, n) || 1;
  return { e: e / len, n: n / len };
}

// --- events: high gate, alarms, fuel calls ----------------------------------------

function descentTick(ctx: Ctx): void {
  const sim = ctx.sim;
  const ship = sim.ship;
  const m = ctx.memo;
  if (ship.landed) return;
  const f = localFrame(ship, sim.primary);

  // High gate: the computer commits to a site — and it is a boulder field.
  if (!sim.terrain && ship.firing && f.h <= HIGH_GATE) {
    const at = naturalSite(ship, sim.primary).applyAxisAngle(Y, -sim.primary.spinAt(sim.met));
    sim.terrain = new BoulderField(at, R, FIELD_SEED);
    m.siteE = m.siteN = 0;
    sim.emit('HIGH GATE — P64. THE LPD SHOWS WHERE THE COMPUTER IS TAKING YOU', 'warn');
  }

  const c = command(ctx);
  if (sim.terrain && !m.lowGate && c.phase === 'P66 LAND') m.lowGate = 1; // one-way

  // Program alarms: the executive overflows, restarts, and flies on.
  const alarm = ALARMS[m.alarms ?? 0];
  if (alarm && ship.firing && f.h < alarm[0]) {
    m.alarms = (m.alarms ?? 0) + 1;
    m.alarmAt = sim.met;
    m.alarmCode = alarm[1];
    [m.frozenX, m.frozenY, m.frozenZ, m.frozenThrottle] = [c.dir.x, c.dir.y, c.dir.z, c.throttle];
    m.freezeUntil = sim.met + RESTART;
    sim.emit(`PROGRAM ALARM ${alarm[1]}`, 'bad');
  }

  // Fuel calls, counted down to bingo.
  const call = FUEL_CALLS[m.calls ?? 0];
  if (call !== undefined && ship.firing && hoverSeconds(sim) - BINGO_RESERVE <= call) {
    m.calls = (m.calls ?? 0) + 1;
    m.callAt = sim.met;
    sim.emit(call ? `${call} SECONDS` : 'BINGO — LAND IT OR LOSE IT', call ? 'warn' : 'bad');
  }
}

// --- the landing point designator ---------------------------------------------------

function designate(ctx: Ctx, how: Designation): string {
  const sim = ctx.sim;
  const m = ctx.memo;
  const field = sim.terrain;
  if (!field) return 'THE LPD COMES ALIVE AT HIGH GATE';
  if (m.lowGate || sim.ship.landed) return 'LPD IS OUT — IN P66 YOU FLY IT THERE';
  const h = heading(ctx);
  const here = field.local(sim.ship.position.clone().applyAxisAngle(Y, -sim.primary.spinAt(sim.met)));
  let spot: { e: number; n: number };
  if ('at' in how) {
    spot = field.local(how.at);
    if ((spot.e - here.e) * h.e + (spot.n - here.n) * h.n < 0) return "LPD — THAT'S BEHIND YOU";
  } else {
    // A click moves the site 2° of look angle: finer as you close in.
    const target = field.point(m.siteE, m.siteN).multiplyScalar(R);
    const slant = target.distanceTo(sim.ship.position.clone().applyAxisAngle(Y, -sim.primary.spinAt(sim.met)));
    const step = slant * Math.tan(LPD_CLICK);
    const [along, across] = how.clicks;
    spot = { e: m.siteE + (h.e * along + h.n * across) * step, n: m.siteN + (h.n * along - h.e * across) * step };
  }
  const reach = Math.hypot(spot.e, spot.n);
  if (reach > LPD_REACH) spot = { e: (spot.e * LPD_REACH) / reach, n: (spot.n * LPD_REACH) / reach };
  m.siteE = spot.e;
  m.siteN = spot.n;
  const hazard = field.hazardAt(field.point(spot.e, spot.n));
  return hazard ? 'LPD — STILL IN THE BOULDERS' : `LPD — CLEAR GROUND, ${range(Math.hypot(spot.e, spot.n))} FROM THE COMPUTER'S SITE`;
}

// --- the crew's automation and CAPCOM -------------------------------------------------

/**
 * What Apollo's crew had when flying by hand: the computer throttles
 * through P63/P64 while you fly the attitude; in P66 Shift/Ctrl click the
 * rate of descent and the computer holds it. X shuts the DPS down; Z relights.
 */
function descentAssist(ctx: Ctx, dt: number, input: number): boolean {
  const ship = ctx.sim.ship;
  if (ship.landed || ship.throttle === 0 || ship.fuel <= 0) return false;
  const c = command(ctx);
  if (c.phase !== 'P66 LAND') {
    ship.throttle = Math.max(0.05, c.throttle);
    delete ctx.memo.rod;
    return true;
  }
  const f = localFrame(ship, ctx.sim.primary);
  ctx.memo.rod ??= Math.max(-3, Math.min(-0.5, f.vz));
  ctx.memo.rod = Math.max(-5, Math.min(1, ctx.memo.rod + input * ROD_RATE * dt));
  const lift = Math.max(0.3, ship.forward.dot(f.up));
  const az = 1.5 * (ctx.memo.rod - f.vz) + f.gEff;
  ship.throttle = Math.max(0.05, Math.min(1, (az * ship.mass) / (ship.stage.thrust * lift)));
  return true;
}

/** P66 rate-of-descent change per second of Shift/Ctrl, m/s. */
const ROD_RATE = 1;

/** DPS never lit this phase, and more than 90 s past perilune: this pass is gone. */
function missedPdi(ctx: Ctx): boolean {
  const sim = ctx.sim;
  const o = sim.orbit;
  if (sim.ship.fuel < ctx.memo.pdiFuel - 1 || !o.closed) return false;
  const since = sim.met - ((o.nextPeriapsis(sim.met) ?? sim.met) - o.period);
  return since > 90 && since < o.period - 60;
}

function descentCall(ctx: Ctx): string {
  const sim = ctx.sim;
  const ship = sim.ship;
  const m = ctx.memo;
  const f = localFrame(ship, sim.primary);
  const since = (t: number | undefined) => (t === undefined ? Infinity : sim.met - t);

  if (!ship.firing && f.h > 1_000) return 'LIGHT THE DPS — Z. THE COMPUTER THROTTLES; YOU FLY THE ◇ (F HOLDS IT).';
  if (since(m.alarmAt) < ALARM_TALK) {
    const code = m.alarmCode;
    if (since(m.alarmAt) < 3.5) return `PROGRAM ALARM… IT'S A ${code}. GIVE US A READING ON THE ${code}.`;
    return m.alarms === 1 ? "HOUSTON: WE'RE GO ON THAT ALARM. THE COMPUTER IS SHEDDING WORK — FLY ON." : `HOUSTON: SAME TYPE — WE'RE GO. KEEP FLYING.`;
  }
  const hover = hoverSeconds(sim);
  if ((m.calls ?? 0) >= FUEL_CALLS.length) return `BINGO. ${Math.round(hover)} SECONDS OF HOVER — GET IT DOWN.`;
  if (since(m.callAt) < 5) return `${FUEL_CALLS[m.calls - 1]} SECONDS.`;

  const c = command(ctx);
  if (c.phase === 'P66 LAND') {
    const rod = m.rod ?? f.vz;
    if (f.vh > 3) return `P66 — YOU HAVE IT. DRIFT ${speed(f.vh, 1)}: NULL IT WITH THE STICK (OR F) BEFORE YOU SET DOWN.`;
    return f.h > 30
      ? `P66. ${Math.round(f.h)} M, SINK ${speed(-rod, 1)} — SHIFT SLOWS IT, CTRL SPEEDS IT. AIM FOR UNDER 1.5 M/S AT CONTACT.`
      : `${Math.round(f.h)} M… DOWN ${speed(-f.vz, 1)}… PICKING UP SOME DUST.`;
  }
  const site = siteDir(ctx);
  if (site && sim.terrain!.hazardAt(site)) {
    return "THE COMPUTER IS TAKING YOU INTO A BOULDER FIELD. REDESIGNATE — ARROWS OR CLICK THE GROUND — OR TAKE IT LONG IN P66.";
  }
  if (c.phase === 'P64 APPROACH') return `P64. ${km(f.h, 1)}. LPD SITE CLEAR — THE COMPUTER FLIES YOU THERE; P66 AT LOW GATE IS YOURS.`;
  return `P63 BRAKING. ${km(f.h, 1)}, ${speed(f.vh)} ACROSS THE GROUND. AUTO THROTTLE; YOU'RE GO.`;
}
