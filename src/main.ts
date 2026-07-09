import { Clock, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { EARTH, RENDER_SCALE, SHIP } from './constants';
import { Input } from './input';
import { createPlanet } from './render/planet';
import { OrbitLine } from './render/orbitLine';
import { createShip } from './render/ship';
import { createStarfield } from './render/starfield';
import { Stage } from './render/stage';
import { MissionLog } from './sim/missions';
import { Simulation } from './sim/simulation';
import { Hud } from './ui/hud';
import { notify } from './ui/notify';

const stage = new Stage(document.getElementById('app')!);
const sim = new Simulation();
const missions = new MissionLog();
const hud = new Hud();

// --- scene contents ---
const planet = createPlanet();
const shipView = createShip();
const orbitLine = new OrbitLine();
stage.scene.add(planet, shipView.group, orbitLine.group, createStarfield());

// --- camera ---
const controls = new OrbitControls(stage.camera, stage.renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.08;
controls.maxDistance = 400;

function resetCamera(): void {
  const shipPos = sim.ship.position.clone().multiplyScalar(RENDER_SCALE);
  const away = shipPos.clone().normalize();
  // Above and behind: ship in the foreground, Earth's limb filling the lower frame.
  stage.camera.position
    .copy(shipPos)
    .addScaledVector(away, 1.1)
    .add(new Vector3(0, 1.5, 0.9));
  controls.target.copy(shipPos);
}

// --- input ---
let ended = false;

const input = new Input({
  onWarpUp() {
    sim.setWarpIndex(sim.warpIndex + 1);
    notify(`TIME WARP ${sim.warp}×`, sim.warp > 1 ? 'warn' : 'ok');
  },
  onWarpDown() {
    sim.setWarpIndex(sim.warpIndex - 1);
    notify(`TIME WARP ${sim.warp}×`, sim.warp > 1 ? 'warn' : 'ok');
  },
  onToggleSas() {
    sim.ship.sas = !sim.ship.sas;
    notify(sim.ship.sas ? 'SAS ENGAGED' : 'SAS OFF');
  },
  onReset() {
    sim.reset();
    missions.reset();
    ended = false;
    resetCamera();
    notify('FLIGHT RESET');
  },
  onToggleHelp() {
    document.getElementById('help')!.classList.toggle('hidden');
  },
  onMaxThrottle() {
    sim.ship.throttle = 1;
  },
  onCutThrottle() {
    sim.ship.throttle = 0;
  },
});

// --- main loop ---
const clock = new Clock();
const THROTTLE_RATE = 0.7; // full sweep in ~1.4 s

function frame(): void {
  requestAnimationFrame(frame);
  update(Math.min(clock.getDelta(), 0.05));
}

function update(dt: number): void {
  const elapsed = clock.elapsedTime;

  sim.ship.throttle = Math.min(1, Math.max(0, sim.ship.throttle + input.throttleDelta * THROTTLE_RATE * dt));
  sim.step(dt, input.rotation, input.burn);
  for (const event of sim.events) notify(event, 'warn');

  // Mission progress.
  const done = missions.update(sim);
  if (done) {
    notify(`OBJECTIVE COMPLETE: ${done}`, 'ok');
    if (missions.allComplete) notify('GO FOR SPLASHDOWN', 'ok');
  }
  sim.recoverable = missions.allComplete;
  if (sim.status === 'splashdown' && !ended) {
    ended = true;
    notify('SPLASHDOWN — MISSION COMPLETE', 'ok');
  } else if (sim.status === 'crashed' && !ended) {
    ended = true;
    notify('VEHICLE LOST — PRESS R TO RESET', 'bad');
  }

  // Sync render space.
  const shipPos = sim.ship.position.clone().multiplyScalar(RENDER_SCALE);
  const prevTarget = controls.target.clone();
  shipView.group.position.copy(shipPos);
  shipView.group.quaternion.copy(sim.ship.quaternion);
  shipView.setPlume(sim.ship.firing ? sim.ship.throttle : 0, elapsed);
  orbitLine.update(sim.elements);

  // Planet rotates in real time (cosmetic, so warp shows).
  planet.rotation.y += ((Math.PI * 2) / EARTH.siderealDay) * dt * sim.warp;

  // Camera rides along with the ship.
  controls.target.copy(shipPos);
  stage.camera.position.add(shipPos.clone().sub(prevTarget));
  controls.update();

  hud.update(sim, missions, sim.ship.fuel / SHIP.fuelMass);
  stage.render(elapsed);
}

resetCamera();
notify('ORBITAL FLIGHT CONSOLE READY');
frame();

if (import.meta.env.DEV) {
  // Console harness: lets tests drive the loop when rAF is throttled.
  Object.assign(window, { __game: { sim, missions, update, resetCamera, controls } });
}
