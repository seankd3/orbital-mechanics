import { MOON } from '../../constants';
import { MOON_BODY } from '../../sim/bodies';
import { perilune, solveCircularize, solveMidcourse, solveTli, TARGET } from '../../sim/targeting';
import { clock, km } from '../../ui/format';
import { starsFor, type Chapter, type Ctx } from '../chapter';
import { burnSay, coastPath, engine, line, now } from './common';

const R = MOON.radius;

/** Signed perilune of the coast from here, if the path meets the Moon. */
function approach(ctx: Ctx): number | null {
  const sim = ctx.sim;
  if (sim.primary === MOON_BODY) return Math.sign(sim.orbit.hVec.y) * sim.orbit.periapsis;
  return perilune(coastPath(sim));
}

function periluneError(ctx: Ctx): number {
  const p = approach(ctx);
  return p === null ? Infinity : Math.abs(p - TARGET.perilune);
}

export const TLI: Chapter = {
  id: 'tli',
  title: 'TRANS-LUNAR INJECTION',
  summary: 'Light the S-IVB and throw Columbia at the Moon.',
  phases: [
    {
      kind: 'burn',
      name: 'TLI',
      solve: (ctx, tig) => solveTli(now(ctx.sim), engine(ctx.sim), tig ?? ctx.sim.met + 300),
      say: (ctx) =>
        burnSay(
          ctx,
          ctx.sim.met - ctx.t0 < 40
            ? "APOLLO 11, HOUSTON. YOU'RE GO FOR TLI. THE ◇ ON THE BALL IS YOUR BURN ATTITUDE — M SHOWS THE MAP."
            : 'THE S-IVB BURN SENDS YOU 3 DAYS UPHILL TO A 110 KM PERILUNE.',
        ),
    },
  ],
  finish(ctx) {
    ctx.sim.ship.dropStage();
    ctx.sim.emit('S-IVB SEP — TRANSPOSITION AND DOCKING COMPLETE', 'good');
  },
  failed: (ctx) =>
    ctx.sim.ship.fuel <= 0 && ctx.guide && ctx.guide.remaining(ctx.sim.ship) > 50 ? 'S-IVB DEPLETED SHORT OF TLI' : null,
  grade(ctx) {
    const err = periluneError(ctx);
    const p = approach(ctx);
    return {
      stars: starsFor(err, [500e3, 2_500e3, 30_000e3], ctx),
      lines: [
        line('PREDICTED PERILUNE', p === null ? 'MISSES THE MOON' : km(Math.abs(p) - R), err < 2_500e3),
        line('TARGET', km(Math.abs(TARGET.perilune) - R), true),
      ],
    };
  },
};

export const MIDCOURSE: Chapter = {
  id: 'mcc',
  title: 'MIDCOURSE CORRECTION',
  summary: 'Trim the coast so perilune lands on 110 km — or skip it if TLI was clean.',
  phases: [
    {
      kind: 'burn',
      name: 'MCC-2',
      waive: 0.3,
      solve: (ctx, tig) => solveMidcourse(now(ctx.sim), engine(ctx.sim), tig ?? ctx.t0 + 20 * 3600),
      say: (ctx) => burnSay(ctx, 'TRACKING SHOWS YOUR PERILUNE OFF THE MARK. MCC-2 IS A SMALL SPS BURN — FEATHER IT WITH THE THROTTLE.'),
    },
    {
      kind: 'coast',
      name: 'TRANSLUNAR COAST',
      until: (ctx) => {
        if (ctx.memo.soi === undefined) {
          const moonArc = coastPath(ctx.sim).find((a) => a.primary === MOON_BODY);
          ctx.memo.soi = moonArc ? moonArc.t0 : ctx.sim.met + 3 * 86_400;
        }
        return ctx.memo.soi;
      },
      enter: (ctx) => void delete ctx.memo.soi,
      say: (ctx) => {
        const p = approach(ctx);
        const left = (ctx.memo.soi ?? ctx.sim.met) - ctx.sim.met;
        return `PERILUNE ${p === null ? '—' : km(Math.abs(p) - R)}. THE MOON'S SPHERE OF INFLUENCE IN ${clock(left)} — G TO COAST THERE.`;
      },
    },
  ],
  failed: (ctx) => {
    const p = approach(ctx);
    if (ctx.sim.ship.firing || p === null) return null;
    return Math.abs(p) < R + 20_000 ? 'IMPACT TRAJECTORY — PERILUNE BELOW 20 KM' : null;
  },
  grade(ctx) {
    const err = periluneError(ctx);
    const p = approach(ctx);
    return {
      stars: starsFor(err, [25e3, 150e3, 1_000e3], ctx),
      lines: [
        line('PERILUNE', p === null ? '—' : km(Math.abs(p) - R), err < 150e3),
        line('ERROR', km(err), err < 25e3),
      ],
    };
  },
};

export const LOI: Chapter = {
  id: 'loi',
  title: 'LUNAR ORBIT INSERTION',
  summary: 'Behind the Moon, out of contact: burn retrograde and stay.',
  phases: [
    {
      kind: 'burn',
      name: 'LOI',
      solve: (ctx) => solveCircularize(now(ctx.sim), engine(ctx.sim)),
      say: (ctx) =>
        burnSay(ctx, "YOU'RE GO FOR LOI. THE BURN IS AT PERILUNE, BEHIND THE MOON — IF IT DOESN'T HAPPEN, YOU FLY STRAIGHT ON PAST."),
    },
  ],
  failed: (ctx) => {
    const o = ctx.sim.orbit;
    if (ctx.guide?.phase !== 'done' && ctx.sim.ship.fuel > 0) return null;
    return o.closed ? null : 'NOT CAPTURED — COLUMBIA IS FLYING PAST THE MOON';
  },
  grade(ctx) {
    const o = ctx.sim.orbit;
    const target = TARGET.lunarOrbit;
    const err = Math.max(Math.abs(o.apoapsis - target), Math.abs(o.periapsis - target));
    return {
      stars: o.periapsis > R + 20_000 ? starsFor(err, [15e3, 40e3, 150e3], ctx) : 0,
      lines: [
        line('ORBIT', `${km(o.periapsis - R)} × ${km(o.apoapsis - R)}`, err < 40e3),
        line('TARGET', `${km(target - R)} CIRCULAR`, true),
      ],
    };
  },
};
