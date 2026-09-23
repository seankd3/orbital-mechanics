import { EARTH_BODY } from '../../sim/bodies';
import { lookQuaternion } from '../../sim/executor';
import { currentBank, entryBank } from '../../sim/guidance';
import type { Simulation } from '../../sim/simulation';
import { earthArc, entryAngle, solveEntryCorridor, solveTei, TARGET } from '../../sim/targeting';
import { clock, degrees, km, speed } from '../../ui/format';
import { starsFor, type Chapter, type Ctx } from '../chapter';
import { burnSay, coastPath, DEG, engine, line, now } from './common';

/** Predicted flight-path angle at entry interface (rad), if the path comes home. */
function predictedEntry(sim: Simulation): number | null {
  const arc = earthArc(coastPath(sim));
  return arc ? entryAngle(arc.orbit) : null;
}

export const TEI: Chapter = {
  id: 'tei',
  title: 'TRANS-EARTH INJECTION',
  summary: 'One burn behind the Moon decides whether you come home.',
  phases: [
    {
      kind: 'burn',
      name: 'TEI',
      solve: (ctx, tig) => solveTei(now(ctx.sim), engine(ctx.sim), tig ?? ctx.sim.met + 600),
      say: (ctx) =>
        burnSay(ctx, "COLUMBIA, YOU'RE GO FOR TEI. IT'S ON THE FAR SIDE — AIM FOR A −6.5° ENTRY, AND THE PACIFIC WILL DO THE REST."),
    },
  ],
  failed: (ctx) => {
    if (ctx.guide?.phase !== 'done') return null;
    return predictedEntry(ctx.sim) === null ? 'NOT ON A RETURN TRAJECTORY' : null;
  },
  grade(ctx) {
    const gamma = predictedEntry(ctx.sim);
    const err = gamma === null ? Infinity : Math.abs(gamma - TARGET.entryAngle);
    return {
      stars: starsFor(err, [0.5 * DEG, 1.5 * DEG, 4 * DEG], ctx),
      lines: [
        line('PREDICTED ENTRY', gamma === null ? 'NO RETURN' : gamma > 0 ? 'MISSES EARTH' : degrees(gamma, 2), err < 1.5 * DEG),
        line('CORRIDOR', `${degrees(TARGET.entryAngle, 1)} ± 1.5°`, true),
      ],
    };
  },
};

const PEAK_G_LIMIT = 16;

export const ENTRY: Chapter = {
  id: 'entry',
  title: 'ENTRY & SPLASHDOWN',
  summary: 'Trim the corridor, cut loose the SM, and fly the lift vector home.',
  begin(ctx) {
    ctx.sim.peakG = 0;
  },
  phases: [
    {
      kind: 'burn',
      name: 'MCC-7',
      waive: 0.3,
      solve(ctx, tig) {
        const arc = earthArc(coastPath(ctx.sim));
        const soon = ctx.sim.met + 15 * 60;
        return solveEntryCorridor(now(ctx.sim), engine(ctx.sim), tig ?? (arc ? Math.max(soon, arc.t1 - 8 * 3600) : soon));
      },
      say: (ctx) => burnSay(ctx, 'THE CORRIDOR IS TIGHT. MCC-7 TRIMS YOUR ENTRY ANGLE BACK TO −6.5°.'),
    },
    {
      kind: 'coast',
      name: 'COAST TO ENTRY',
      enter: (ctx) => void delete ctx.memo.ei,
      until: (ctx) => {
        if (ctx.memo.ei === undefined) {
          const arc = earthArc(coastPath(ctx.sim));
          ctx.memo.ei = arc ? arc.t1 : ctx.sim.met;
        }
        return ctx.memo.ei - 10 * 60;
      },
      arrive(ctx) {
        const sim = ctx.sim;
        sim.ship.dropStage(); // SPS → CM
        // Heat shield forward, lift up.
        sim.ship.quaternion.copy(lookQuaternion(sim.ship.velocity.clone().negate(), sim.ship.position));
        sim.emit('CM/SM SEP — HEAT SHIELD FORWARD, LIFT UP', 'good');
      },
      say: (ctx) => {
        const gamma = predictedEntry(ctx.sim);
        return `ENTRY INTERFACE IN ${clock((ctx.memo.ei ?? ctx.sim.met) - ctx.sim.met)}, ${gamma === null ? '—' : degrees(gamma, 2)}. G TO COAST THERE.`;
      },
    },
    {
      kind: 'pilot',
      name: 'ENTRY',
      cue: (ctx) => ({ bank: entryBank(ctx.sim).bank, label: ctx.sim.chutes === 'none' ? 'P65 ENTRY' : 'CHUTES' }),
      autopilot(ctx) {
        const sim = ctx.sim;
        sim.hold = null;
        sim.rotation = { pitch: 0, yaw: 0, roll: rollCommand(sim) };
      },
      done: (ctx) => ctx.sim.outcome?.kind === 'splashdown',
      say: (ctx) => entryCall(ctx),
    },
  ],
  failed: (ctx) => {
    const sim = ctx.sim;
    if (sim.peakG > PEAK_G_LIMIT) return `CREW LOST — ${sim.peakG.toFixed(0)} G`;
    const climbing = sim.ship.velocity.dot(sim.ship.position) > 0;
    if (sim.peakG > 0.5 && climbing && sim.altitude > 130_000 && sim.primary === EARTH_BODY) {
      return 'SKIPPED OUT OF THE ATMOSPHERE — LIFT DOWN SOONER';
    }
    return null;
  },
  grade(ctx) {
    const g = ctx.sim.peakG;
    return {
      stars: starsFor(g, [7.5, 9, 12], ctx),
      lines: [line('PEAK LOAD', `${g.toFixed(1)} G`, g <= 7.5), line('SPLASHDOWN', 'MID-PACIFIC', true)],
    };
  },
};

/** Roll toward the guidance bank (keeps the current left/right side). */
export function rollCommand(sim: Simulation): number {
  const target = entryBank(sim).bank;
  const bank = currentBank(sim);
  const err = (bank >= 0 ? 1 : -1) * target - bank;
  return Math.max(-1, Math.min(1, -2 * err - 1.5 * sim.ship.angularVelocity.z));
}

function entryCall(ctx: Ctx): string {
  const sim = ctx.sim;
  if (sim.chutes === 'mains') return 'THREE GOOD CHUTES. WELCOME HOME, APOLLO 11.';
  if (sim.chutes === 'drogue') return 'DROGUES OUT.';
  const target = entryBank(sim).bank;
  const bank = Math.abs(currentBank(sim));
  const alt = sim.altitude;
  if (alt > EARTH_BODY.atmosphere) return `${km(alt)} TO INTERFACE, ${speed(sim.ship.velocity.length())}. KEEP LIFT UP — Q/E ROLL THE LIFT VECTOR.`;
  const off = Math.abs(bank - target) > 20 * DEG;
  const dir = target < 60 * DEG ? 'LIFT UP' : target > 120 * DEG ? 'LIFT DOWN' : 'LIFT HORIZONTAL';
  return `${sim.gLoad.toFixed(1)} G. BANK ${Math.round(bank / DEG)}° — GUIDANCE WANTS ${Math.round(target / DEG)}° (${dir}).${off ? ' ROLL, Q/E!' : ''}`;
}

