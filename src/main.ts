import { Clock, Vector3 } from 'three';
import './style.css';
import { MOON, RENDER_SCALE, WARP_LEVELS } from './constants';
import { Campaign } from './game/campaign';
import { CHAPTERS } from './game/chapters';
import { Director } from './game/director';
import { launchSnapshot, NominalFlight } from './game/nominal';
import { Input, type Command } from './input';
import { CameraRig } from './render/camera';
import { pickSphere } from './render/pick';
import { Stage } from './render/stage';
import { World, type Paths } from './render/world';
import { engineOf, predictBurn, predictCoast, predictRemaining, stateOf } from './sim/burn';
import { MOON_BODY } from './sim/bodies';
import { Simulation, type Snapshot } from './sim/simulation';
import { Audio } from './ui/audio';
import { Hud } from './ui/hud';
import { MapView } from './ui/mapview';
import { Navball } from './ui/navball';
import { notify } from './ui/notify';
import { hideOverlay, renderHelp, showAbort, showBusy, showDebrief, showFinale, showMenu } from './ui/overlay';
import { currentBank } from './sim/guidance';

type Mode = 'menu' | 'flying' | 'debrief' | 'abort' | 'finale';

const HORIZON = 12 * 86_400;
const Y_AXIS = new Vector3(0, 1, 0);
const THROTTLE_RATE = 0.6; // full sweep in ~1.7 s

const stage = new Stage(document.getElementById('app')!);
const sim = new Simulation();
const world = new World(stage.scene);
const rig = new CameraRig(stage);
const hud = new Hud();
const navball = new Navball(document.getElementById('navball')!);
const audio = new Audio();
const input = new Input();
const campaign = new Campaign();
const nominal = new NominalFlight();

let mode: Mode = 'menu';
let director: Director | null = null;
let chapter = 0;
let menuSel = Math.min(campaign.data.unlocked, CHAPTERS.length - 1);
let holdCue = false;
let lastActive = sim.activeId;
let paths: Paths = { current: null, plan: null, partner: null };
const mapView = new MapView(
  document.getElementById('ui')!, stage.canvas, stage.map, () => director, sim,
  () => rig.mode === 'map' && mode === 'flying',
  () => rig.mode === 'chase' && mode === 'flying',
  stage.chase,
);

input.onFirstKey = () => audio.init();

// Click the ground (chase view) to put the landing point designator there;
// a drag still orbits the camera.
let press: { x: number; y: number } | null = null;
stage.canvas.addEventListener('pointerdown', (e) => (press = { x: e.clientX, y: e.clientY }));
stage.canvas.addEventListener('pointerup', (e) => {
  const click = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5;
  press = null;
  if (!click || mode !== 'flying' || rig.mode !== 'chase' || !director?.cue?.site) return;
  const hit = pickSphere(stage.chase, e.clientX, e.clientY, world.moon.position, MOON.radius * RENDER_SCALE);
  if (!hit) return;
  const said = director.designate({ at: hit.applyAxisAngle(Y_AXIS, -MOON_BODY.spinAt(sim.met)).normalize() });
  if (said) notify(said, said.includes('BOULDERS') ? 'warn' : 'info');
});
hud.onTransmission = () => audio.quindar();
renderHelp();

// --- flow -------------------------------------------------------------------

function setMode(m: Mode): void {
  mode = m;
  document.getElementById('ui')!.classList.toggle('menu', m === 'menu');
}

function openMenu(): void {
  setMode('menu');
  director = null;
  sim.warp = 1;
  sim.warpUntil = null;
  showMenu(campaign, menuSel, (i) => ((menuSel = i), flyFromMenu(i)));
}

/** Chapters picked from the menu fly from the nominal flight's state. */
function flyFromMenu(i: number): void {
  showBusy('COMPUTING THE NOMINAL TRAJECTORY…');
  setTimeout(() => {
    try {
      startChapter(i, nominal.start(i));
    } catch (e) {
      openMenu();
      notify('NOMINAL TRAJECTORY FAILED — SEE CONSOLE', 'warn');
      throw e;
    }
  }, 30);
}

function startChapter(i: number, start: Snapshot): void {
  chapter = i;
  director = new Director(CHAPTERS[i], sim, start);
  setMode('flying');
  holdCue = false;
  hideOverlay();
  rig.setMode('chase');
  rig.resetChase(sim.activeId === 'lm' ? 45 : 70);
  lastActive = sim.activeId;
  campaign.setResume(i, start);
  drain();
}

function drain(): void {
  for (const e of sim.events) {
    notify(e.text, e.tone);
    if (e.tone === 'good') audio.chime();
    if (e.voice) audio.voice(e.voice);
  }
  sim.events.length = 0;
}

function finishChapter(d: Director): void {
  campaign.record(chapter, d.grade!.stars);
  const last = chapter === CHAPTERS.length - 1;
  campaign.setResume(chapter + 1, last ? null : sim.snapshot());
  setMode('debrief');
  showDebrief(chapter, d.grade!, d.ctx.usedAuto, last);
}

// --- commands ------------------------------------------------------------------

function command(cmd: Command): void {
  if (mode === 'menu') {
    if (cmd === 'up') menuSel = Math.max(0, menuSel - 1);
    if (cmd === 'down') menuSel = Math.min(campaign.data.unlocked, menuSel + 1);
    if (cmd === 'up' || cmd === 'down') openMenu();
    if (cmd === 'enter') flyFromMenu(menuSel);
    const resume = campaign.data.resume;
    if (cmd === 'continue' && resume) startChapter(resume.chapter, resume.start);
    return;
  }
  if (cmd === 'menu') return openMenu();
  if (cmd === 'help') {
    const help = document.getElementById('help')!;
    help.hidden = !help.hidden;
    return;
  }
  if (mode === 'debrief') {
    if (cmd === 'enter') {
      if (chapter === CHAPTERS.length - 1) {
        setMode('finale');
        showFinale(campaign);
        audio.voice('big-board'); // JFK's goal on the Mission Control big board: accomplished
      } else startChapter(chapter + 1, sim.snapshot());
    }
    if (cmd === 'restart' && director) startChapter(chapter, director.start);
    return;
  }
  if (mode === 'finale') {
    if (cmd === 'enter') openMenu();
    return;
  }
  if (mode === 'abort') {
    if (cmd === 'restart' && director) startChapter(chapter, director.start);
    return;
  }
  if (!director) return;
  const ship = sim.ship;
  switch (cmd) {
    case 'restart': return startChapter(chapter, director.start);
    case 'throttle-full': ship.throttle = 1; break;
    case 'throttle-cut': ship.throttle = 0; break;
    case 'hold':
      holdCue = !holdCue && !!director.cue?.dir;
      notify(holdCue ? 'ATTITUDE HOLD — ON THE CUE' : 'ATTITUDE HOLD OFF');
      break;
    case 'sas':
      ship.sas = !ship.sas;
      notify(ship.sas ? 'SAS ON' : 'SAS OFF');
      break;
    case 'auto':
      director.toggleAuto();
      // Taking a lit burn back: keep the attitude on the cue; cutoff is yours.
      if (!director.auto && ship.firing && director.cue?.dir) holdCue = true;
      notify(director.auto ? 'AUTO — THE COMPUTER HAS IT (MAX ★★)' : holdCue ? 'MANUAL — HOLDING THE CUE, X TO CUT OFF' : 'MANUAL CONTROL', 'warn');
      break;
    case 'map': rig.setMode(rig.mode === 'map' ? 'chase' : 'map'); break;
    case 'focus':
      rig.focus = rig.focus === 'auto' ? 'earth' : rig.focus === 'earth' ? 'moon' : 'auto';
      rig.mapZoom = 1;
      notify(`MAP FOCUS ${rig.focus.toUpperCase()}`);
      break;
    case 'enter': director.accept(); break;
    case 'replan':
      notify(director.replan() ? 'BURN RESTORED TO THE COMPUTER SOLUTION' : 'NO UNLIT BURN TO RESTORE');
      break;
    case 'up':
    case 'down':
    case 'left':
    case 'right': {
      // Landing point designator: ↑/↓ long/short, ←/→ across track.
      const clicks: [number, number] = cmd === 'up' ? [1, 0] : cmd === 'down' ? [-1, 0] : cmd === 'left' ? [0, -1] : [0, 1];
      const said = director.designate({ clicks });
      if (said) notify(said, said.includes('BOULDERS') ? 'warn' : 'info');
      break;
    }
    case 'warp-next': {
      const t = director.nextEvent;
      if (t !== null && t > sim.met + 1) sim.warpUntil = t;
      else notify('NOTHING TO WARP TO — FLY IT');
      break;
    }
    case 'warp-up':
    case 'warp-down': {
      sim.warpUntil = null;
      const i = WARP_LEVELS.findIndex((w) => w >= sim.warp);
      const next = WARP_LEVELS[Math.max(0, Math.min(WARP_LEVELS.length - 1, (i < 0 ? 0 : i) + (cmd === 'warp-up' ? 1 : -1)))];
      if (next > sim.maxWarp) notify('WARP LIMITED UNDER POWER', 'warn');
      sim.warp = Math.min(next, sim.maxWarp);
      break;
    }
  }
}

// --- frame ----------------------------------------------------------------------

function fly(dt: number): void {
  const d = director!;
  const ship = sim.ship;
  if (input.manual && d.auto) {
    d.auto = false;
    notify('MANUAL TAKEOVER', 'warn');
  }
  if (input.steering) holdCue = false;
  sim.rotation = input.rotation;
  sim.translation = input.translation;
  ship.throttle = Math.min(1, Math.max(0, ship.throttle + input.throttleRate * THROTTLE_RATE * dt));
  sim.hold = holdCue ? d.holdTarget() : null;
  if (holdCue && !sim.hold) holdCue = false;

  // G: an eased warp that lands exactly on the event.
  if (sim.warpUntil !== null) sim.warp = Math.min(100_000, Math.max(20, (sim.warpUntil - sim.met) / 0.6));

  d.preStep(dt, input.throttleRate);
  sim.step(dt);
  d.postStep();
  drain();

  if (d.status === 'complete') finishChapter(d);
  else if (d.status === 'failed') {
    setMode('abort');
    showAbort(chapter, d.failure ?? 'ABORT');
  }
  if (sim.activeId !== lastActive) {
    lastActive = sim.activeId;
    rig.resetChase(sim.activeId === 'lm' ? 45 : 70);
  }
}

/** Predicted paths: the coast, the planned burn's outcome, the partner's orbit. */
function predict(): Paths {
  const now = stateOf(sim.ship, sim.primary, sim.met);
  const landedOrLow = sim.ship.landed || sim.inAtmosphere;
  const current = landedOrLow ? null : predictCoast(now, HORIZON);
  let plan = null;
  const g = director?.status === 'flying' ? director.guide : null;
  if (g && g.phase !== 'done' && director?.maneuver) {
    if (g.litAt === null) {
      plan = predictBurn(now, engineOf(sim.ship), director.maneuver, HORIZON).arcs;
    } else {
      plan = predictRemaining(now, engineOf(sim.ship), g.toGo(sim.ship), HORIZON);
    }
  }
  const other = sim.other;
  const partner = other && !other.landed ? predictCoast(stateOf(other, sim.primary, sim.met), sim.orbit.closed ? sim.orbit.period : 7200) : null;
  return { current, plan, partner };
}

const clock = new Clock();

function frame(): void {
  requestAnimationFrame(frame);
  update(Math.min(clock.getDelta(), 0.05));
}

function update(dt: number): void {
  for (const cmd of input.drain()) command(cmd);
  if (mode === 'flying') fly(dt);
  else if (mode === 'menu') rig.az += dt * 0.04; // a slow orbit behind the title
  paths = predict();
  render(dt);
}

function render(dt: number): void {
  const map = rig.mode === 'map';
  const time = clock.elapsedTime;
  const d = mode === 'flying' ? director : null;
  const cue = d?.cue;
  const lpd = cue?.site ? { site: cue.site, hazard: !!cue.hazard } : null;
  world.sync(sim, paths, map, time, (2 * stage.mapHalfHeight) / window.innerHeight, lpd);
  if (map) rig.updateMap(sim, [paths.current, paths.plan], dt);
  else rig.updateChase(sim, world.craftPosition(sim, sim.activeId));
  mapView.update(paths);

  hud.update(sim, d, { map, hold: holdCue, plan: paths.plan });
  const rel = sim.relative();
  const inEntry = d?.phase?.name === 'ENTRY' && sim.chutes === 'none';
  navball.update({
    quaternion: sim.ship.quaternion,
    position: sim.ship.position,
    velocity: sim.ship.velocity,
    cue: cue?.dir ?? null,
    target: rel && d?.chapter.id === 'rendezvous' ? { pos: rel.pos, vel: rel.vel } : null,
    bank: inEntry ? { current: currentBank(sim), target: cue?.bank ?? 0 } : null,
  });
  const ship = sim.ship;
  const lowFuel = mode === 'flying' && ship.firing && ship.fuelFraction < 0.06;
  audio.update(ship.firing, ship.throttle, Math.min(1, ship.stage.thrust / 1e6), lowFuel || !!cue?.alarm);
  if (mode === 'flying' && sim.translation && (sim.translation.x || sim.translation.y || sim.translation.z)) audio.rcs();
  stage.render();
}

// --- boot -----------------------------------------------------------------------

sim.restore(launchSnapshot());
openMenu();
frame();

if (import.meta.env.DEV) {
  // Test harness: drive the loop directly when rAF is throttled.
  Object.assign(window, {
    __game: {
      sim, campaign, nominal, rig, CHAPTERS,
      get director() { return director; },
      get mode() { return mode; },
      update,
      start: (i: number, snapshot?: Snapshot) => startChapter(i, snapshot ?? nominal.start(i)),
      command,
      /** Fly `steps` frames without drawing, then draw one (software GL is slow). */
      advance(steps: number, dt = 1 / 30) {
        for (let i = 0; i < steps && mode === 'flying'; i++) fly(dt);
        paths = predict();
        render(dt);
      },
    },
  });
}
