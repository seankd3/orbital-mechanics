import { EARTH } from '../constants';
import type { MissionLog } from '../sim/missions';
import type { Simulation } from '../sim/simulation';
import { fmtDegrees, fmtDistance, fmtMet, fmtPeriod, fmtSpeed, fmtWarp } from './format';

const el = (id: string) => document.getElementById(id)!;

export class Hud {
  private readonly alt = el('alt');
  private readonly vel = el('vel');
  private readonly apo = el('apo');
  private readonly peri = el('peri');
  private readonly ecc = el('ecc');
  private readonly inc = el('inc');
  private readonly period = el('period');
  private readonly sma = el('sma');
  private readonly sas = el('sas');
  private readonly engine = el('engine');
  private readonly dv = el('dv');
  private readonly throttleBar = el('throttle-bar');
  private readonly throttlePct = el('throttle-pct');
  private readonly fuelBar = el('fuel-bar');
  private readonly fuelPct = el('fuel-pct');
  private readonly met = el('met');
  private readonly warp = el('warp');
  private readonly warpBox = el('warp-box');
  private readonly missionList = el('mission-list');
  private lastMissionKey = '';

  update(sim: Simulation, missions: MissionLog, fuelFraction: number): void {
    const e = sim.elements;
    const ship = sim.ship;

    this.alt.textContent = fmtDistance(sim.altitude);
    this.vel.textContent = fmtSpeed(ship.velocity.length());
    this.apo.textContent = isFinite(e.apoapsis) ? fmtDistance(e.apoapsis - EARTH.radius) : 'ESCAPE';
    this.peri.textContent = fmtDistance(e.periapsis - EARTH.radius);
    this.peri.className = e.periapsis - EARTH.radius < 120_000 ? 'bad' : '';

    this.ecc.textContent = e.eccentricity.toFixed(4);
    this.inc.textContent = fmtDegrees(e.inclination);
    this.period.textContent = fmtPeriod(e.period);
    this.sma.textContent = fmtDistance(e.semiMajorAxis);

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
    this.fuelBar.style.width = `${Math.round(fuelFraction * 100)}%`;
    this.fuelPct.textContent = `${Math.round(fuelFraction * 100)}%`;

    this.met.textContent = fmtMet(sim.met);
    this.warp.textContent = fmtWarp(sim.warp);
    this.warpBox.classList.toggle('warping', sim.warp > 1);

    this.renderMissions(missions);
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
