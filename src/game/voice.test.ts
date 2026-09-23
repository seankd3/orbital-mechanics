import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim/simulation';
import { CHAPTERS } from './chapters';
import { Director } from './director';
import { NominalFlight } from './nominal';
import { VOICE } from './voice';

describe('mission audio', () => {
  it('has a clip for every line, and a line for every clip', () => {
    const clips = Object.keys(import.meta.glob('../../public/audio/apollo11/*.mp3'))
      .map((path) => path.replace(/^.*\//, '').replace(/\.mp3$/, ''))
      .sort();
    expect(clips).toEqual(Object.keys(VOICE).sort());
  });
});


const DT = 1 / 30;
const nominal = new NominalFlight();

/** Fly a chapter on AUTO (G through coasts), collecting the voice lines with their MET. */
function voicesOf(id: string): { voice: string; met: number; d: Director }[] {
  const sim = new Simulation();
  const d = new Director(CHAPTERS.find((c) => c.id === id)!, sim, nominal.start(CHAPTERS.findIndex((c) => c.id === id)));
  const heard = sim.events.filter((e) => e.voice).map((e) => ({ voice: e.voice!, met: sim.met, d }));
  sim.events.length = 0;
  d.toggleAuto();
  for (let i = 0; i < 60 * 30 * 60 && d.status === 'flying'; i++) {
    if (!sim.ship.firing && d.phase?.kind === 'coast' && d.nextEvent !== null) {
      sim.warpUntil = d.nextEvent;
      sim.warp = 1e9;
    }
    d.preStep(DT);
    sim.step(DT);
    d.postStep();
    for (const e of sim.events) if (e.voice) heard.push({ voice: e.voice, met: sim.met, d });
    sim.events.length = 0;
  }
  expect(d.status).toBe('complete');
  return heard;
}

describe('mission audio on the timeline', () => {
  it('calls the descent the way the loop did', () => {
    const heard = voicesOf('descent').map((h) => h.voice);
    expect(heard).toEqual(['go-for-pdi', 'alarm-1202', 'alarm-1202-again', 'alarm-1201', 'sixty-seconds', 'contact-light', 'eagle-has-landed']);
  });

  it('counts the ascent down so "proceed" lands on the liftoff window', () => {
    const heard = voicesOf('ascent');
    expect(heard.map((h) => h.voice)).toEqual(['small-step', 'cleared-for-takeoff', 'ascent-countdown', 'smooth-ride']);
    const { met, d } = heard.find((h) => h.voice === 'ascent-countdown')!;
    expect(d.ctx.memo.window - met).toBeCloseTo(9.4, 0);
  });
});
