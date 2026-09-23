import { EARTH_BODY, MOON_BODY } from '../sim/bodies';
import type { Arc } from '../sim/coast';
import { localFrame, currentBank } from '../sim/guidance';
import type { Simulation } from '../sim/simulation';
import { earthArc, entryAngle, perilune } from '../sim/targeting';
import type { Director } from '../game/director';
import { CHAPTERS } from '../game/chapters';
import { clock, degrees, km, met, range, speed, warp } from './format';

const $ = (id: string) => document.getElementById(id)!;

type Row = [label: string, value: string, cls?: string];

function rows(list: Row[]): string {
  return list.map(([k, v, cls]) => `<div class="row"><span class="k">${k}</span><b class="${cls ?? ''}">${v}</b></div>`).join('');
}

function bar(fraction: number, bug?: number, low = false): string {
  const w = Math.max(0, Math.min(1, fraction)) * 100;
  const b = bug === undefined ? '' : `<span class="bug" style="left:${Math.max(0, Math.min(1, bug)) * 100}%"></span>`;
  return `<div class="bar${low ? ' low' : ''}"><i style="width:${w}%"></i>${b}</div>`;
}

/** What a path achieves, in the terms the current burn cares about. */
export function forecast(arcs: Arc[] | null): string {
  if (!arcs?.length) return '—';
  const p = perilune(arcs);
  const first = arcs[0];
  if (first.primary === EARTH_BODY && p !== null) {
    const alt = Math.abs(p) - MOON_BODY.radius;
    return alt < 0 ? 'LUNAR IMPACT' : `PERILUNE ${km(alt)}`;
  }
  const home = first.primary === MOON_BODY && !first.orbit.closed ? earthArc(arcs) : null;
  if (home) {
    const g = entryAngle(home.orbit);
    return g > 0 ? 'MISSES EARTH' : `ENTRY ${degrees(g, 2)}`;
  }
  const o = first.orbit;
  const R = first.primary.radius;
  if (!o.closed) return 'ESCAPE';
  if (o.periapsis < R) return `SUBORBITAL · AP ${km(o.apoapsis - R, 1)}`;
  return `${km(o.periapsis - R, o.periapsis - R < 50e3 ? 1 : 0)} × ${km(o.apoapsis - R)}`;
}

/** DOM flight instruments. */
export class Hud {
  private lastCall = '';
  private revealAt = 0;
  onTransmission: (() => void) | null = null;

  update(sim: Simulation, d: Director | null, view: { map: boolean; hold: boolean; plan: Arc[] | null }): void {
    $('met').textContent = met(sim.met);
    $('chapter').textContent = d ? `CH ${CHAPTERS.indexOf(d.chapter) + 1} · ${d.chapter.title}` : '';
    $('warp').textContent = warp(sim.warp);
    $('view').textContent = view.map ? 'MAP' : 'CHASE';
    $('auto').classList.toggle('on', !!d?.auto);
    $('hold').classList.toggle('on', view.hold);
    this.capcom(d?.capcom ?? '');
    this.orbit(sim);
    this.engine(sim, d);
    $('card').innerHTML = d ? this.card(sim, d, view.plan) : '';
  }

  private capcom(text: string): void {
    const el = $('capcom');
    // A new transmission (not just a countdown tick) gets quindar and a reveal.
    const skeleton = text.replace(/[\d:.,−-]+/g, '#');
    if (skeleton !== this.lastCall) {
      this.lastCall = skeleton;
      this.revealAt = performance.now();
      if (text) this.onTransmission?.();
    }
    const shown = Math.floor((performance.now() - this.revealAt) / 14);
    el.textContent = shown >= text.length ? text : text.slice(0, shown);
  }

  private orbit(sim: Simulation): void {
    const o = sim.orbit;
    const R = sim.primary.radius;
    const list: Row[] = [
      ['BODY', sim.primary.name],
      ['ALTITUDE', range(sim.altitude)],
      ['VELOCITY', speed(sim.ship.velocity.length())],
    ];
    if (sim.ship.landed) {
      list.push(['STATUS', 'ON THE SURFACE', 'good']);
    } else {
      list.push(['APOAPSIS', o.closed ? range(o.apoapsis - R) : 'ESCAPE']);
      list.push(['PERIAPSIS', o.periapsis < R ? 'SUBORBITAL' : range(o.periapsis - R), o.periapsis < R ? 'bad' : '']);
      const tPe = o.nextPeriapsis(sim.met);
      if (tPe !== null && tPe - sim.met < 30 * 86_400) list.push(['T PERIAPSIS', clock(tPe - sim.met)]);
    }
    $('orbit').innerHTML = rows(list);
  }

  private engine(sim: Simulation, d: Director | null): void {
    const ship = sim.ship;
    const stage = ship.stage;
    const cue = d?.cue;
    const state = stage.thrust <= 0 ? '—' : ship.fuel <= 0 ? 'DRY' : ship.firing ? 'BURN' : 'IDLE';
    const html =
      rows([
        [sim.docked && sim.lmAlive ? `${ship.spec.label}+LM` : ship.spec.label, `${stage.name} ${state}`, ship.firing ? 'plan' : ''],
        ['THROTTLE', `${Math.round(ship.throttle * 100)}%`],
      ]) +
      bar(ship.throttle, cue?.throttle) +
      rows([[stage.name === 'CM' ? 'PROPELLANT' : `${stage.name} PROP`, stage.fuelMass ? `${Math.round(ship.fuelFraction * 100)}%` : '—']]) +
      bar(ship.fuelFraction, undefined, ship.fuelFraction < 0.1) +
      rows([
        ['ΔV LEFT', speed(ship.deltaV)],
        ['RCS', `${Math.round((ship.rcsFuel / ship.spec.rcsFuelMass) * 100)}%`],
      ]);
    $('engine').innerHTML = html;
  }

  private card(sim: Simulation, d: Director, plan: Arc[] | null): string {
    const p = d.phase;
    if (!p || d.status !== 'flying') return '';
    if (p.kind === 'burn' && d.guide) {
      const g = d.guide;
      const ship = sim.ship;
      const lit = g.litAt !== null;
      const toIgn = g.ignition - sim.met;
      const done = 1 - Math.max(0, g.remaining(ship)) / g.total;
      return (
        `<h3>${p.name} BURN</h3>` +
        `<div class="row"><span class="k">ΔV TO GO</span><b class="big plan">${speed(g.remaining(ship), 1)}</b></div>` +
        `<div class="meter"><i style="width:${done * 100}%"></i></div>` +
        rows([
          ['ΔV PLANNED', speed(g.total, 1)],
          lit ? ['BURNING', clock(sim.met - g.litAt!)] : ['IGNITION', toIgn >= 0 ? `T−${clock(toIgn)}` : `LATE ${clock(-toIgn)}`, toIgn < 0 ? 'bad' : ''],
          ['BURN TIME', clock(g.duration)],
          ['ATTITUDE', `${((ship.forward.angleTo(g.cue(ship)) * 180) / Math.PI).toFixed(1)}° OFF`, ship.forward.angleTo(g.cue(ship)) < 0.035 ? 'good' : 'plan'],
          ['RESULT', forecast(plan), 'plan'],
        ])
      );
    }
    if (p.kind === 'coast') {
      const t = (d.nextEvent ?? sim.met) - sim.met;
      return `<h3>${p.name}</h3>` + rows([['NEXT EVENT', `T−${clock(t)}`], ['WARP', 'G']]);
    }
    const cue = d.cue;
    switch (p.name) {
      case 'DESCENT': {
        const f = localFrame(sim.ship, sim.primary);
        const burnSeconds = sim.ship.fuel / (sim.ship.stage.thrust / sim.ship.exhaustVelocity) / Math.max(0.3, sim.ship.throttle);
        return (
          `<h3>${cue?.label ?? p.name}</h3>` +
          `<div class="row"><span class="k">ALTITUDE</span><b class="big">${range(f.h)}</b></div>` +
          rows([
            ['SINK RATE', speed(-f.vz, 1), -f.vz > 3 && f.h < 200 ? 'bad' : ''],
            ['DRIFT', speed(f.vh, f.vh < 100 ? 1 : 0)],
            ['DPS LEFT', `${Math.round(burnSeconds)} S`, burnSeconds < 60 ? 'bad' : ''],
            ['GUIDANCE THR', `${Math.round((cue?.throttle ?? 0) * 100)}%`, 'plan'],
          ])
        );
      }
      case 'ASCENT': {
        const f = localFrame(sim.ship, sim.primary);
        return (
          `<h3>${cue?.label ?? p.name}</h3>` +
          `<div class="row"><span class="k">TO ORBIT</span><b class="big plan">${speed(cue?.toGo ?? 0)}</b></div>` +
          rows([
            ['ALTITUDE', range(f.h)],
            ['CLIMB', speed(f.vz, 1)],
            ['ORBIT', forecast([{ primary: sim.primary, orbit: sim.orbit, t0: sim.met, t1: sim.met, end: null }])],
          ])
        );
      }
      case 'DOCKING': {
        const rel = sim.relative();
        if (!rel) return '';
        const closing = -rel.rangeRate;
        const limit = Math.min(6, Math.max(0.25, rel.range / 60));
        const lateral = rel.vel.clone().addScaledVector(rel.pos.clone().normalize(), -rel.vel.dot(rel.pos) / rel.range).length();
        return (
          `<h3>PROX OPS — COLUMBIA</h3>` +
          `<div class="row"><span class="k">RANGE</span><b class="big tgt">${range(rel.range)}</b></div>` +
          rows([
            ['CLOSING', speed(closing, 2), closing > limit * 1.5 ? 'bad' : closing < 0 ? 'plan' : 'good'],
            ['SAFE RATE', `≤ ${speed(limit, 2)}`],
            ['DRIFT', speed(lateral, 2), lateral > 0.5 ? 'plan' : ''],
            ['RCS', `${Math.round((sim.ship.rcsFuel / sim.ship.spec.rcsFuelMass) * 100)}%`],
          ])
        );
      }
      case 'ENTRY': {
        const bank = Math.abs(currentBank(sim));
        return (
          `<h3>${cue?.label ?? 'ENTRY'}</h3>` +
          `<div class="row"><span class="k">LOAD</span><b class="big ${sim.gLoad > 8 ? 'bad' : ''}">${sim.gLoad.toFixed(1)} G</b></div>` +
          rows([
            ['PEAK', `${sim.peakG.toFixed(1)} G`],
            ['BANK', `${Math.round((bank * 180) / Math.PI)}°`],
            ['GUIDANCE', `${Math.round(((cue?.bank ?? 0) * 180) / Math.PI)}°`, 'plan'],
            ['VELOCITY', speed(sim.ship.velocity.length())],
          ])
        );
      }
    }
    return '';
  }
}
