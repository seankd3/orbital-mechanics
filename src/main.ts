import { Clock, Quaternion, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { EARTH, RENDER_SCALE, SHIP } from './constants';
import { Input } from './input';
import { createMoon } from './render/moon';
import { createPlanet } from './render/planet';
import { createNodeMarker, OrbitLine } from './render/orbitLine';
import { createLmView, createShip } from './render/ship';
import { createStarfield } from './render/starfield';
import { Stage } from './render/stage';
import { EARTH_BODY, MOON_BODY } from './sim/bodies';
import { MissionLog } from './sim/missions';
import { Simulation } from './sim/simulation';
import { AudioEngine } from './ui/audio';
import { Hud } from './ui/hud';
import { Navball } from './ui/navball';
import { notify } from './ui/notify';

const stage = new Stage(document.getElementById('app')!);
const sim = new Simulation();
const missions = new MissionLog();
const hud = new Hud();
const navball = new Navball();
const audio = new AudioEngine();

// --- scene contents ---
const planet = createPlanet();
const moon = createMoon();
const csmView = createShip();
const lmView = createLmView();
const orbitLine = new OrbitLine({ color: '#2e7d8c', markers: true });
const predictedLine = new OrbitLine({ color: '#b08b2e', opacity: 0.8 });
const nodeMarker = createNodeMarker();
nodeMarker.visible = false;
stage.scene.add(
  planet, moon, csmView.group, lmView.group,
  orbitLine.group, predictedLine.group, nodeMarker,
  createStarfield(),
);

// --- camera ---
let mapMode = false;
const controls = new OrbitControls(stage.camera, stage.renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.08;
controls.maxDistance = 800;

function resetCamera(): void {
  const shipPos = sim.absolutePosition.multiplyScalar(RENDER_SCALE);
  const away = sim.ship.position.clone().normalize();
  // Above and behind: ship in the foreground, the primary's limb below.
  stage.camera.position
    .copy(shipPos)
    .addScaledVector(away, 1.1)
    .add(new Vector3(0, 1.5, 0.9));
  controls.target.copy(shipPos);
}

function setMapMode(on: boolean): void {
  mapMode = on;
  controls.enabled = !on;
  stage.setActiveCamera(on ? stage.mapCamera : stage.camera);
  if (on) stage.setMapZoom(sim.primary === MOON_BODY ? 5.2 : 16);
}

window.addEventListener(
  'wheel',
  (e) => {
    if (!mapMode) return;
    stage.setMapZoom(stage.mapZoom * (e.deltaY > 0 ? 1.15 : 1 / 1.15));
  },
  { passive: true },
);

// --- input ---
let ended = false;

const input = new Input({
  onAnyKey: () => audio.init(),
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
    setMapMode(false);
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
  onToggleNode() {
    if (sim.planner.active) {
      sim.planner.clear();
      notify('NODE CLEARED');
    } else {
      sim.planner.create(sim);
      notify('MANEUVER NODE — T−2:00');
    }
  },
  onExecuteNode() {
    sim.planner.execute(sim);
  },
  onNodeDv(delta) {
    if (!sim.planner.active) sim.planner.create(sim);
    sim.planner.adjust('prograde', delta);
  },
  onNodeTig(delta) {
    if (sim.planner.active) sim.planner.adjustTig(sim, delta);
  },
  onToggleMap() {
    setMapMode(!mapMode);
    notify(mapMode ? 'MAP VIEW' : 'CRAFT VIEW');
  },
  onSwitchCraft() {
    sim.switchCraft();
  },
});

// --- console buttons ---
function wireButtons(): void {
  const on = (selector: string, fn: (b: HTMLButtonElement) => void) => {
    document.querySelectorAll<HTMLButtonElement>(selector).forEach((b) =>
      b.addEventListener('click', () => {
        fn(b);
        b.blur(); // keep SPACE from re-triggering the button
      }),
    );
  };
  on('[data-hold]', (b) => sim.apollo.setHold(b.dataset.hold as never));
  on('[data-burn]', (b) => {
    switch (b.dataset.burn) {
      case 'tli': sim.apollo.startTli(sim); break;
      case 'circ': sim.apollo.startCircularize(sim); break;
      case 'loi': sim.apollo.startLoi(sim); break;
      case 'tei': sim.apollo.startTei(sim); break;
      case 'off': sim.apollo.clearGuidance(); break;
    }
  });
  on('[data-vehicle]', (b) => {
    switch (b.dataset.vehicle) {
      case 'undock': sim.undock(); break;
      case 'dock': sim.dock(); break;
      case 'stage':
        if (sim.ship.canStage) {
          const dropped = sim.ship.stage.name;
          sim.ship.dropStage();
          notify(`${dropped} JETTISONED — ${sim.ship.stage.name} ACTIVE`, 'warn');
        }
        break;
      case 'switch': sim.switchCraft(); break;
    }
  });
  on('[data-checkpoint]', (b) => {
    if (b.dataset.checkpoint === 'earth') sim.setCircularOrbit(EARTH_BODY, 185_000);
    else sim.setCircularOrbit(MOON_BODY, 110_000);
    ended = false;
    setMapMode(false);
    resetCamera();
  });
  on('[data-node-time]', (b) => {
    if (sim.planner.active) sim.planner.adjustTig(sim, Number(b.dataset.nodeTime));
  });
  on('[data-node-at]', (b) => {
    if (sim.planner.active) sim.planner.setTigAt(sim, b.dataset.nodeAt as never);
  });
  on('[data-node-axis]', (b) => {
    if (!sim.planner.active) sim.planner.create(sim);
    sim.planner.adjust(b.dataset.nodeAxis as never, Number(b.dataset.nodeDelta));
  });
  on('[data-node-cmd]', (b) => {
    switch (b.dataset.nodeCmd) {
      case 'create':
        sim.planner.create(sim);
        notify('MANEUVER NODE — T−2:00');
        break;
      case 'execute': sim.planner.execute(sim); break;
      case 'clear':
        sim.planner.clear();
        notify('NODE CLEARED');
        break;
    }
  });
}
wireButtons();

// --- main loop ---
const clock = new Clock();
const THROTTLE_RATE = 0.7; // full sweep in ~1.4 s
const LM_DOCK_OFFSET = 6.6; // ship-units, CSM nose to LM tunnel, nose-to-nose
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
let prevActive = sim.activeId;

function frame(): void {
  requestAnimationFrame(frame);
  update(Math.min(clock.getDelta(), 0.05));
}

function update(dt: number): void {
  const elapsed = clock.elapsedTime;

  sim.ship.throttle = Math.min(1, Math.max(0, sim.ship.throttle + input.throttleDelta * THROTTLE_RATE * dt));
  const translation = input.translation;
  sim.step(dt, input.rotation, input.burn, translation);
  for (const event of sim.events) notify(event, 'warn');

  // Mission progress (the training program is Earth ops only).
  if (sim.primary === EARTH_BODY) {
    const done = missions.update(sim);
    if (done) {
      notify(`OBJECTIVE COMPLETE: ${done}`, 'ok');
      if (missions.allComplete) notify('GO FOR SPLASHDOWN', 'ok');
    }
    sim.recoverable = missions.allComplete;
  }
  if (sim.status === 'splashdown' && !ended) {
    ended = true;
    notify('SPLASHDOWN — MISSION COMPLETE', 'ok');
  } else if (sim.status === 'crashed' && !ended) {
    ended = true;
    notify('VEHICLE LOST — PRESS R TO RESET', 'bad');
  }

  // Camera follows control: snap over when the crew changes seats.
  if (sim.activeId !== prevActive) {
    prevActive = sim.activeId;
    resetCamera();
  }

  // Sync render space (Earth-centered inertial).
  const primaryRenderPos = sim.primary.positionAt(sim.met).multiplyScalar(RENDER_SCALE);
  const shipPos = sim.absolutePosition.multiplyScalar(RENDER_SCALE);
  const prevTarget = controls.target.clone();
  const iconScale = SHIP.visualScale * (mapMode ? 40 : 1);

  moon.position.copy(MOON_BODY.positionAt(sim.met).multiplyScalar(RENDER_SCALE));

  // CSM.
  const csmPos = sim.activeId === 'csm'
    ? shipPos
    : primaryRenderPos.clone().addScaledVector(sim.csm.position, RENDER_SCALE);
  csmView.group.position.copy(csmPos);
  csmView.group.quaternion.copy(sim.csm.quaternion);
  csmView.group.scale.setScalar(iconScale);
  csmView.setStaged?.(sim.csm.stagesDropped > 0);
  csmView.setPlume(sim.csm.firing ? sim.csm.throttle : 0, elapsed);

  // LM: docked to the CSM's nose, flying free, or gone.
  lmView.group.visible = sim.lmAlive;
  if (sim.lmAlive) {
    lmView.setStaged?.(sim.lm.stagesDropped > 0);
    lmView.group.scale.setScalar(iconScale);
    if (sim.docked) {
      lmView.group.position
        .copy(csmPos)
        .addScaledVector(sim.csm.forward, LM_DOCK_OFFSET * iconScale);
      lmView.group.quaternion.copy(sim.csm.quaternion).multiply(FLIP);
      lmView.setPlume(0, elapsed);
    } else {
      const lmPos = sim.activeId === 'lm'
        ? shipPos
        : primaryRenderPos.clone().addScaledVector(sim.lm.position, RENDER_SCALE);
      lmView.group.position.copy(lmPos);
      lmView.group.quaternion.copy(sim.lm.quaternion);
      lmView.setPlume(sim.lm.firing ? sim.lm.throttle : 0, elapsed);
    }
  }

  orbitLine.group.position.copy(primaryRenderPos);
  orbitLine.update(sim.elements);

  sim.planner.predict(sim);
  predictedLine.group.position.copy(primaryRenderPos);
  predictedLine.update(sim.planner.predicted);
  if (sim.planner.active) {
    nodeMarker.visible = true;
    nodeMarker.position
      .copy(sim.planner.nodeState(sim).position)
      .multiplyScalar(RENDER_SCALE)
      .add(primaryRenderPos);
    nodeMarker.rotation.y += dt * 1.5;
  } else {
    nodeMarker.visible = false;
  }

  // Planet rotates in real time (cosmetic, so warp shows).
  planet.rotation.y += ((Math.PI * 2) / EARTH.siderealDay) * dt * sim.warp;

  // Camera: follow the ship, or look down the orbit normal in map mode.
  if (mapMode) {
    const normal = sim.elements.hVec.clone().normalize();
    stage.mapCamera.position.copy(primaryRenderPos).addScaledVector(normal, 1500);
    stage.mapCamera.up.copy(sim.ship.position.clone().normalize());
    stage.mapCamera.lookAt(primaryRenderPos);
  } else {
    controls.target.copy(shipPos);
    stage.camera.position.add(shipPos.clone().sub(prevTarget));
    controls.update();
  }

  // Instruments + audio.
  navball.update(
    sim.ship.position,
    sim.ship.velocity,
    sim.ship.quaternion,
    sim.planner.active ? sim.planner.burnVector(sim) : null,
  );
  audio.update(sim.ship.firing, sim.ship.throttle, sim.ship.fuel / sim.ship.stage.fuelMass);
  if (translation.x !== 0 || translation.y !== 0 || translation.z !== 0) audio.fireRcs();

  hud.update(sim, missions, mapMode);
  stage.render(elapsed);
}

resetCamera();
notify('ORBITAL FLIGHT CONSOLE READY');
frame();

if (import.meta.env.DEV) {
  // Console harness: lets tests drive the loop when rAF is throttled.
  Object.assign(window, { __game: { sim, missions, update, resetCamera, controls, setMapMode } });
}
