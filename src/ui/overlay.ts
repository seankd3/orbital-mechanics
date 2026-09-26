import type { Grade } from '../game/chapter';
import { CHAPTERS } from '../game/chapters';
import type { Campaign } from '../game/campaign';

const root = () => document.getElementById('overlay')!;

function stars(n: number, of = 3): string {
  return '★'.repeat(n) + `<span class="off">${'★'.repeat(of - n)}</span>`;
}

export function hideOverlay(): void {
  root().hidden = true;
  root().innerHTML = '';
}

/** Title screen and chapter list. `onPick` gets the chapter index. */
export function showMenu(campaign: Campaign, selected: number, onPick: (i: number) => void): void {
  const { stars: best, unlocked, resume } = campaign.data;
  const items = CHAPTERS.map((c, i) => {
    const locked = i > unlocked;
    const cls = [locked ? 'locked' : '', i === selected ? 'sel' : ''].join(' ');
    const mark = locked ? '—' : best[i] ? '★'.repeat(best[i]) + '<span class="off">' + '★'.repeat(3 - best[i]) + '</span>' : '';
    return `<li class="${cls}" data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${c.title}<small>${c.summary}</small></span><span class="stars">${mark}</span></li>`;
  }).join('');
  const cont = resume ? `CONTINUE YOUR FLIGHT AT CHAPTER ${resume.chapter + 1} — <b>C</b> · ` : '';
  root().innerHTML = `
    <div class="panel">
      <h2>APOLLO 11 · JULY 1969</h2>
      <h1>ORBITAL</h1>
      <p class="lead">Fly the first landing from Earth orbit to the Sea of Tranquility and home. Houston tells you what comes next and why; you fly it. Every chapter is graded — ★★★ takes a clean hand-flown job.</p>
      <ul class="chapters">${items}</ul>
      <div class="keys">${cont}↑↓ SELECT · <b>ENTER</b> FLY · ${campaign.totalStars}/${CHAPTERS.length * 3} ★</div>
      <a class="watch" href="trailer/">▶ WATCH THE TRAILER</a>
    </div>`;
  root().hidden = false;
  root().querySelectorAll<HTMLElement>('li[data-i]').forEach((li) => {
    li.addEventListener('click', () => {
      const i = Number(li.dataset.i);
      if (i <= unlocked) onPick(i);
    });
  });
}

export function showBusy(text: string): void {
  root().innerHTML = `<div class="panel"><h2>${text}</h2></div>`;
  root().hidden = false;
}

export function showDebrief(index: number, grade: Grade, usedAuto: boolean, last: boolean): void {
  const c = CHAPTERS[index];
  const lines = grade.lines.map((l) => `<div class="row"><span class="k">${l.label}</span><b class="${l.ok ? 'good' : 'plan'}">${l.value}</b></div>`).join('');
  root().innerHTML = `
    <div class="panel">
      <h2>CHAPTER ${index + 1} COMPLETE</h2>
      <h1 style="font-size:24px;letter-spacing:0.2em">${c.title}</h1>
      <div class="stars-big">${stars(grade.stars)}</div>
      ${usedAuto ? '<p class="note">The computer flew part of this chapter — ★★★ needs a hand-flown job.</p>' : ''}
      <div class="result">${lines}</div>
      <div class="keys"><b>ENTER</b> ${last ? 'FINISH' : 'NEXT CHAPTER'} · <b>R</b> FLY IT AGAIN · <b>ESC</b> MENU</div>
    </div>`;
  root().hidden = false;
}

export function showAbort(index: number, reason: string): void {
  root().innerHTML = `
    <div class="panel abort">
      <h2>ABORT — CHAPTER ${index + 1}</h2>
      <h1 style="font-size:24px;letter-spacing:0.12em">${reason}</h1>
      <p class="lead">Flight dynamics has the numbers. Take it again from the top of the chapter — it only costs you seconds.</p>
      <div class="keys"><b>R</b> RESTART CHAPTER · <b>ESC</b> MENU</div>
    </div>`;
  root().hidden = false;
}

export function showFinale(campaign: Campaign): void {
  root().innerHTML = `
    <div class="panel">
      <h2>SPLASHDOWN · MID-PACIFIC</h2>
      <h1 style="font-size:30px;letter-spacing:0.3em">MISSION COMPLETE</h1>
      <p class="lead">"Houston, Tranquility Base here." You flew it all the way — out, down, up and home.</p>
      <div class="stars-big">${campaign.totalStars} / ${CHAPTERS.length * 3} ★</div>
      <div class="keys"><b>ENTER</b> MENU</div>
    </div>`;
  root().hidden = false;
}

const HELP: [string, string][] = [
  ['W/S A/D Q/E', 'Pitch, yaw, roll'],
  ['F', 'Hold attitude on the ◇ cue'],
  ['T', 'SAS rate damping'],
  ['Z / X', 'Throttle full / cut off'],
  ['SHIFT / CTRL', 'Throttle up / down · P66: sink rate'],
  ['I/K J/L U/O', 'RCS translate (docking)'],
  ['G', 'Warp to the next event'],
  [', / .', 'Time warp down / up'],
  ['B', 'Hand this phase to the computer'],
  ['ENTER', 'Accept a short burn · continue'],
  ['M · TAB', 'Map view · map focus'],
  ['DRAG ◇', 'In the map: move the burn, re-solve'],
  ['BACKSPACE', 'Restore the computer’s burn'],
  ['R · ESC', 'Restart chapter · menu'],
];

export function renderHelp(): void {
  document.getElementById('help')!.innerHTML =
    '<h4>KEYS</h4>' + HELP.map(([k, v]) => `<span class="k">${k}</span><span class="d">${v}</span>`).join('');
}
