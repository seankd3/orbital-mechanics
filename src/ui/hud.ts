import { SHIP } from '../constants';
import { orbitGuardLabel } from '../sim/apollo';
import { meanMotion, trueToMeanAnomaly } from '../sim/physics';
import type { MissionLog } from '../sim/missions';
import type { Simulation } from '../sim/simulation';
import { fmtDegrees, fmtDistance, fmtMet, fmtPeriod, fmtSpeed, fmtWarp } from './format';

const el = (id: string) => document.getElementById(id)!;

export class Hud {
  private readonly body = el('body');
  private readonly alt = el('alt');
  private readonly vel = el('vel');
  private readonly apo = el('apo');
  private readonly peri = el('peri');
  private readonly ecc = el('ecc');
  private readonly inc = el('inc');
  private readonly period = el('period');
  private readonly tap = el('tap');
  private readonly tpe = el('tpe');
  private readonly guard = el('guard');
  private readonly guidance = el('guidance');
  private readonly sas = el('sas');
  private readonly engine = el('engine');
  private readonly dv = el('dv');
  private readonly throttleBar = el('throttle-bar');
  private readonly throttlePct = el('throttle-pct');
  private readonly fuelBar = el('fuel-bar');
  private readonly fuelPct = el('fuel-pct');
  private readonly rcsBar = el('rcs-bar');
  private readonly rcsPct = el('rcs-pct');
  private readonly met = el('met');
  private readonly warp = el('warp');
  private readonly warpBox = el('warp-box');
  private readonly camMode = el('cam-mode');
  private readonly missionList = el('mission-list');
  private readonly node = {
    state: el('node-state'),
    total: el('node-total'),
    tig: el('node-tig'),
    burn: el('node-burn'),
    align: el('node-align'),
    ap: el('node-ap'),
    pe: el('node-pe'),
    pro: el('node-pro'),
    nrm: el('node-nrm'),
    rad: el('node-rad'),
  };
  private lastMissionKey = '';

  update(sim: Simulation, missions: MissionLog, mapMode: boolean): void {
    const e = sim.elements;
    const ship = sim.ship;
    const R = sim.primary.radius;

    this.body.textContent = sim.primary.name;
    this.alt.textContent = fmtDistance(sim.altitude);
    this.vel.textContent = fmtSpeed(ship.velocity.length());
    this.apo.textContent = isFinite(e.apoapsis) ? fmtDistance(e.apoapsis - R) : 'ESCAPE';
    this.peri.textContent = fmtDistance(e.periapsis - R);
    this.peri.className = e.periapsis - R < 120_000 && sim.primary.hasAtmosphere ? 'bad' : '';

    this.ecc.textContent = e.eccentricity.toFixed(4);
    this.inc.textContent = fmtDegrees(e.inclination);
    this.period.textContent = fmtPeriod(e.period);
    this.tap.textContent = isFinite(e.apoapsis) ? fmtPeriod(timeToAnomaly(sim, Math.PI)) : '—';
    this.tpe.textContent = fmtPeriod(timeToAnomaly(sim, 0));

    const guard = orbitGuardLabel(sim);
    this.guard.textContent = guard.label;
    this.guard.className = guard.ok ? 'on' : 'bad';

    this.guidance.textContent = sim.apollo.statusLabel;
    this.guidance.className = sim.apollo.statusLabel === 'MANUAL' ? 'off' : 'hot';

    this.sas.textContent = ship.sas ? 'ON' : 'OFF';
    this.sas.className = ship.sas ? 'on' : 'off';

    if (ship.fuel <= 0) {
      this.engine.textContent = 'DRY';
      this.engine.className = 'bad';
    } else if (ship.firing) {
      this.engine.textContent = 'BURN';
      this.engine.className = 'hot';
    } else {
      this.engine.textContent = 'IDLE';
      this.engine.className = 'off';
    }

    this.dv.textContent = fmtSpeed(ship.deltaV);
    this.throttleBar.style.width = `${Math.round(ship.throttle * 100)}%`;
    this.throttlePct.textContent = `${Math.round(ship.throttle * 100)}%`;
    this.fuelBar.style.width = `${Math.round((ship.fuel / SHIP.fuelMass) * 100)}%`;
    this.fuelPct.textContent = `${Math.round((ship.fuel / SHIP.fuelMass) * 100)}%`;
    this.rcsBar.style.width = `${Math.round((ship.rcsFuel / SHIP.rcsFuelMass) * 100)}%`;
    this.rcsPct.textContent = `${Math.round((ship.rcsFuel / SHIP.rcsFuelMass) * 100)}%`;

    this.met.textContent = fmtMet(sim.met);
    this.warp.textContent = fmtWarp(sim.warp);
    this.warpBox.classList.toggle('warping', sim.warp > 1);
    this.camMode.textContent = mapMode ? '· MAP' : '';

    this.updateNode(sim);
    this.renderMissions(missions);
  }

  private updateNode(sim: Simulation): void {
    const p = sim.planner;
    if (!p.active) {
      this.node.state.textContent = 'NO NODE';
      this.node.state.className = 'off';
      this.node.total.textContent = '0 m/s';
      this.node.tig.textContent = this.node.burn.textContent = this.node.align.textContent = '—';
      this.node.ap.textContent = this.node.pe.textContent = '—';
      this.node.pro.textContent = this.node.nrm.textContent = this.node.rad.textContent = '+0';
      return;
    }
    this.node.state.textContent = p.burnActive ? 'BURNING' : p.armed ? 'ARMED' : 'PLANNING';
    this.node.state.className = p.burnActive ? 'hot' : p.armed ? 'on' : '';
    this.node.total.textContent = fmtSpeed(p.totalDv);
    this.node.tig.textContent = fmtPeriod(Math.max(0, p.timeToNode(sim)));
    this.node.burn.textContent = `${p.estimateBurnTime(sim.ship.mass).toFixed(0)} s`;
    this.node.align.textContent = `${p.alignmentErrorDeg(sim).toFixed(1)}°`;
    const R = sim.primary.radius;
    if (p.predicted) {
      this.node.ap.textContent = isFinite(p.predicted.apoapsis)
        ? fmtDistance(p.predicted.apoapsis - R)
        : 'ESC';
      this.node.pe.textContent = fmtDistance(p.predicted.periapsis - R);
    } else {
      this.node.ap.textContent = this.node.pe.textContent = '—';
    }
    this.node.pro.textContent = signed(p.prograde);
    this.node.nrm.textContent = signed(p.normal);
    this.node.rad.textContent = signed(p.radial);
  }

  private renderMissions(missions: MissionLog): void {
    const items = missions.all;
    const key = items.map((m) => m.state).join();
    if (key === this.lastMissionKey) return;
    this.lastMissionKey = key;
    this.missionList.replaceChildren(
      ...items.map((m) => {
        const li = document.createElement('li');
        li.textContent = m.label;
        li.className = m.state === 'pending' ? '' : m.state;
        return li;
      }),
    );
  }
}

function signed(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))}`;
}

/** Seconds until the ship reaches the given true anomaly (0=Pe, π=Ap). */
function timeToAnomaly(sim: Simulation, nuTarget: number): number {
  const e = sim.elements;
  if (!isFinite(e.period)) return Infinity;
  const n = meanMotion(e);
  const mNow = trueToMeanAnomaly(e.trueAnomaly, e.eccentricity);
  const mTarget = trueToMeanAnomaly(nuTarget, e.eccentricity);
  let dM = mTarget - mNow;
  while (dM <= 0) dM += Math.PI * 2;
  return dM / n;
}
