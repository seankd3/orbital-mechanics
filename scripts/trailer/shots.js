(() => {
  const { H } = window.TR;
  const g = H.g;
  const cam = (az, el, dist) => Object.assign(g().rig, { az, el, dist });
  const info = () => {
    const s = g().sim;
    const d = g().director;
    return `met ${s.met.toFixed(0)} alt ${(s.altitude / 1e3).toFixed(1)}km ph ${d?.phase?.name} fire ${s.ship.firing} warp ${s.warp}`;
  };

  // A camera that keeps the boulder field behind the LM: from the far side of
  // the craft, swung `swing` rad off the field line, `el` up, `dist` m out.
  const fieldCam = (swing, el, dist) => {
    const G = g();
    const b = G.world.boulders;
    if (!b) return false;
    const V = () => G.stage.chase.position.clone();
    const craft = G.world.craftPosition(G.sim, G.sim.activeId).clone();
    G.world.moon.updateMatrixWorld(true);
    const field = b.group.getWorldPosition(V());
    const up = craft.clone().sub(G.world.moon.getWorldPosition(V())).normalize();
    const d = craft.clone().sub(field);
    d.addScaledVector(up, -d.dot(up)).normalize();
    const side = d.clone().cross(up);
    const h = d.multiplyScalar(Math.cos(swing)).addScaledVector(side, Math.sin(swing));
    const off = h.multiplyScalar(Math.cos(el)).addScaledVector(up, Math.sin(el)).multiplyScalar(dist * 1e-6);
    const c = G.stage.chase;
    c.position.copy(craft).add(off);
    c.up.copy(up);
    c.lookAt(craft);
    c.updateMatrixWorld(true);
    G.stage.render();
    return true;
  };
  // Replays J and I (the same flight) to set K up without recording them.
  const toK = () => {
    const S = window.SHOTS;
    // No draws at all while replaying: queued software-GL frames stall the next screenshot.
    const stage = g().stage;
    stage.render = () => {};
    // Batched (one draw per batch): a draw per step would back the GPU up for minutes.
    S.J.setup();
    g().sim.warp = 1;
    g().advance(75, H.DT); g().command('up');
    g().advance(15, H.DT); H.auto(true);
    g().advance(75, H.DT);
    S.I.setup();
    g().sim.warp = 1;
    g().advance(96, H.DT);
    S.K.setup();
    delete stage.render;
  };

  // ---------- probes: stills to choose angles ----------
  const grid = (list) => ({
    length: list.length,
    still(i) {
      const [az, el, dist] = list[i];
      cam(az, el, dist);
      g().advance(1, H.DT);
      return `${list[i]} ${info()}`;
    },
  });

  window.PROBES = {
    orbit: {
      setup() { g().start(0); H.hud(false); H.view(false); },
      ...grid([[0.55, 0.3, 4e5], [0.55, 0.3, 2e6], [0.55, 0.45, 8e6], [0.55, 0.6, 2.2e7], [1.2, 0.8, 3e7], [0.2, 0.25, 1.5e7]]),
    },
    tli: {
      setup() {
        g().start(0); H.hud(true); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing && g().sim.met > g().director.guide.litAt + 60, 600);
        g().sim.warp = 10;
      },
      ...grid([[0.55, 0.28, 90], [2.7, 0.15, 75], [0.35, 0.1, 60]]),
    },

    kfield: {
      setup() { toK(); g().advance(300, H.DT); return `alt ${g().sim.altitude.toFixed(1)}`; },
      length: 6,
      still(i) {
        const P = [[0.3, 0.22, 55], [-0.3, 0.22, 55], [0.35, 0.3, 70], [0.6, 0.15, 45], [0.2, 0.4, 90], [0, 0.22, 55]][i];
        g().advance(1, H.DT);
        const ok = fieldCam(...P);
        return `${P} ok ${ok} alt ${g().sim.altitude.toFixed(1)}`;
      },
    },

    loi: {
      setup() {
        g().start(2); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing && g().sim.met > g().director.guide.litAt + 40, 600);
        g().sim.warp = 5;
      },
      ...grid([[0.55, 0.28, 90], [2.5, 0.2, 80], [0.9, 0.06, 55], [1.8, 0.5, 400]]),
    },
    undock: {
      setup() { g().start(3); H.hud(false); H.view(false); g().advance(90, H.DT); },
      ...grid([[0.55, 0.28, 45], [2.4, 0.15, 40], [1.2, 0.05, 30], [0.2, 0.35, 70]]),
    },
    pdi: {
      setup() {
        g().start(4); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing && g().sim.altitude < 13000, 300);
        g().sim.warp = 5;
      },
      ...grid([[0.55, 0.28, 45], [2.8, 0.1, 40], [1.4, 0.05, 30], [0.3, 0.6, 60]]),
    },
    gate: {
      setup() {
        g().start(4); H.hud(true); H.view(false);
        H.flyUntil(() => g().director.phase?.name === 'DESCENT', 300);
        g().command('throttle-full'); g().command('hold');
        H.flyUntil(() => !!g().director.cue?.site, 60, 4000, false);
        g().sim.warp = 1;
      },
      ...grid([[0.55, 0.28, 45], [0.3, 0.45, 60], [0.0, 0.7, 80], [2.9, 0.3, 50]]),
    },
    landed: {
      setup() { g().start(5); H.hud(false); H.view(false); g().advance(30, H.DT); },
      ...grid([[0.55, 0.28, 45], [1.5, 0.08, 40], [2.5, 0.1, 40], [3.5, 0.1, 40], [4.5, 0.1, 40], [5.5, 0.1, 40]]),
    },
    landedHigh: {
      setup() { g().start(5); H.hud(false); H.view(false); g().advance(30, H.DT); },
      ...grid([[0.55, 0.3, 200], [0.55, 0.8, 1000], [0.55, 1.3, 4000], [0.55, 0.05, 45]]),
    },
    liftoff: {
      setup() {
        g().start(5); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.met > g().director.ctx.memo.window - 3, 300);
        H.flyUntil(() => !g().sim.ship.landed && g().sim.altitude > 30, 1, 400, false);
      },
      ...grid([[0.55, 0.15, 45], [0.55, -0.05, 60], [1.6, 0.05, 50], [2.8, 0.2, 60]]),
    },
    docking: {
      setup() {
        g().start(6); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().director.phase?.name === 'DOCKING' && g().sim.relative().range < 60, 30, 4000, true, 10);
        g().sim.warp = 1;
      },
      ...grid([[0.08, 0.12, 50], [0.5, 0.2, 40], [2.6, 0.1, 45], [1.3, 0.3, 90]]),
    },
    earthrise: {
      setup() { g().start(7); H.hud(false); H.view(false); g().advance(10, H.DT); },
      ...grid([[0.55, 0.28, 90], [3.14, 0.05, 60], [1.57, 0.05, 60], [4.71, 0.05, 60], [0, 0.05, 60], [2.4, 0.15, 3e4]]),
    },
    entry: {
      setup() {
        g().start(8); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().director.phase?.name === 'ENTRY' && g().sim.gLoad > 3, 30, 4000, true, 10);
        g().sim.warp = 1;
      },
      ...grid([[0.55, 0.28, 30], [2.8, 0.1, 25], [1.4, 0.05, 20], [0.1, 0.4, 40]]),
    },
    chutes: {
      setup() {
        g().start(8); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.chutes === 'mains' && g().sim.chuteOpen > 0.9, 30, 4000, true, 10);
        g().sim.warp = 1;
      },
      ...grid([[0.55, 0.28, 90], [2.8, 0.05, 80], [1.4, -0.1, 70], [0.3, 0.6, 140]]),
    },
    plan: {
      setup() { g().start(0); H.hud(false); H.view(true); g().advance(20, H.DT); },
      ...grid([[0, 0, 0], [0, 0, 0]]),
    },
  };

  // ---------- the trailer's shots ----------
  const E = H.ease;
  const L = H.lerp;
  const step = (warp = 1) => {
    const sim = g().sim;
    if (sim.warpUntil === null) sim.warp = warp;
    g().advance(1, H.DT);
  };
  const black = { setup() {}, frame() {} };
  const memo = () => g().director.ctx.memo;

  window.SHOTS = {
    black1: black,
    title: black,
    black2: black,
    end: black,

    A: {
      setup() { g().start(0); H.hud(false); H.view(false); g().advance(2, H.DT); },
      frame(f, n) {
        const u = f / (n - 1);
        cam(L(0.35, 0.9, E(u)), L(0.12, 0.62, E(u)), 55 * Math.pow(2.4e7 / 55, Math.pow(u, 2.3)));
        step();
      },
    },
    B: {
      setup() {
        g().start(0); H.hud(true); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing && g().sim.met > g().director.guide.litAt + 40, 600);
      },
      frame(f, n) { const u = f / (n - 1); cam(L(0.5, 0.82, E(u)), 0.28, L(92, 72, E(u))); step(10); },
    },
    C: {
      setup() { g().start(0); H.hud('labels'); H.view(true); g().rig.mapZoom = 1.25; g().advance(40, H.DT); },
      frame(f, n) { g().rig.mapZoom = L(1.25, 1.02, E(f / (n - 1))); step(); },
    },
    D: {
      setup() {
        g().start(1); H.hud('labels'); H.view(true); H.auto(true); g().rig.mapZoom = 1.1;
        // If MCC-2 isn't waived, let P40 fly it first.
        H.flyUntil(() => g().director.phase?.kind === 'coast', 60, 4000, true, 1);
        g().advance(40, H.DT);
        return `phase ${g().director.phase?.name} met ${(g().sim.met / 3600).toFixed(1)} h`;
      },
      frame() {
        const sim = g().sim;
        if (sim.warpUntil !== null && sim.met >= sim.warpUntil - 1) sim.warpUntil = null;
        step(4.6e4);
        return `met ${(sim.met / 3600).toFixed(1)} h ${g().director.phase?.name}`;
      },
    },
    E: {
      setup() {
        g().start(2); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing && g().sim.met > g().director.guide.litAt + 30, 600);
      },
      frame(f, n) { cam(L(0.85, 1.15, E(f / (n - 1))), 0.06, 55); step(5); },
    },
    F: {
      setup() { g().start(3); H.hud(false); H.view(false); g().advance(15, H.DT); },
      frame(f, n) { const u = E(f / (n - 1)); cam(L(1.25, 1.05, u), 0.05, L(31, 40, u)); step(3); },
    },
    G: {
      setup() {
        g().start(4); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.ship.firing, 300);
        g().advance(90, H.DT);
      },
      frame(f, n) { cam(L(2.8, 2.6, E(f / (n - 1))), 0.1, 40); step(3); },
    },
    H: {
      setup() {
        g().start(4); H.hud(true); H.view(false); H.auto(true);
        H.flyUntil(() => g().director.phase?.name === 'DESCENT', 300);
        H.flyUntil(() => (memo().alarms ?? 0) >= 1, 10, 4000, false);
      },
      frame(f, n) { cam(L(0.5, 0.72, E(f / (n - 1))), 0.28, 45); step(); },
    },
    // J → I → K are one hand-then-AUTO flight: record them in one run, in that order.
    J: {
      setup() {
        g().start(4); H.hud(true); H.view(false);
        H.flyUntil(() => g().director.phase?.name === 'DESCENT', 300);
        g().command('throttle-full'); g().command('hold');
        H.flyUntil(() => !!g().director.cue?.site, 30, 4000, false);
      },
      frame(f, n) {
        if (f === 75) g().command('up'); // LPD: one click long, past the boulders
        if (f === 90) H.auto(true);
        // Telephoto from behind, down-track at the site: the crater and the LPD read.
        const lens = g().stage.chase;
        lens.fov = L(30, 22, E(f / (n - 1)));
        lens.updateProjectionMatrix();
        cam(L(0.06, 0.02, E(f / (n - 1))), 0.16, 70);
        step();
        if (f === n - 1) { lens.fov = 50; lens.updateProjectionMatrix(); }
        const c = g().director.cue;
        return `site ${!!c?.site} hazard ${c?.hazard}`;
      },
    },
    I: {
      setup() { H.hud(true); H.auto(true); H.flyUntil(() => (memo().alarms ?? 0) >= 3, 5, 4000, false, 1); },
      frame(f, n) { cam(L(2.95, 2.8, E(f / (n - 1))), 0.3, 50); step(); },
    },
    K: {
      tail: true,
      setup() { H.hud(false); H.auto(true); H.flyUntil(() => g().sim.altitude < 70, 5, 4000, false, 3); },
      frame(f) {
        // Keyed to altitude (a tail shot: only the last seconds are used): push in
        // from behind the LM, the boulder field and Earth beyond, down to contact.
        step(2);
        const u = E(Math.max(0, Math.min(1, (22 - g().sim.altitude) / 22)));
        fieldCam(L(0.42, 0.28, u), L(0.21, 0.15, u), L(62, 44, u));
        return g().sim.ship.landed ? 'done' : `alt ${g().sim.altitude.toFixed(1)}`;
      },
    },
    L: {
      setup() { g().start(5); H.hud(false); H.view(false); g().advance(20, H.DT); },
      frame(f, n) { const u = E(f / (n - 1)); cam(L(0.64, 0.5, u), L(0.27, 0.22, u), L(62, 44, u)); step(); },
    },
    M: {
      setup() { g().start(5); H.hud(false); H.view(false); g().advance(20, H.DT); },
      frame(f, n) { const u = E(f / (n - 1)); cam(L(0.2, 0.34, u), L(0.1, 0.13, u), L(34, 30, u)); step(); },
    },
    N: {
      setup() {
        g().start(5); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.met > memo().window - 15, 60);
        H.flyUntil(() => g().sim.met >= memo().window - 4.1, 1, 800, false);
      },
      frame(f, n) {
        const u = f / (n - 1);
        const up = E(Math.max(0, (u - 0.4) / 0.6)); // widen and rise after liftoff to keep the pad in frame
        cam(L(0.55, 0.75, E(u)), L(0.12, 0.42, up), L(42, 150, up));
        step();
      },
    },
    O: {
      setup() {
        g().start(6); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().director.phase?.name === 'DOCKING' && g().sim.relative().range < 34, 30, 6000, true, 10);
        // Capture is at 15 m between centers (the probe in the drogue); start a few meters out.
        H.flyUntil(() => g().sim.docked || g().sim.relative().range < 22, 5, 6000, false, 3);
        return g().sim.docked ? 'ALREADY DOCKED' : `range ${g().sim.relative().range.toFixed(1)}`;
      },
      // A tail shot: the last seconds of the closing, side on, ending on the latch.
      tail: true,
      frame(f) {
        const rel = g().sim.relative();
        const u = E(Math.max(0, Math.min(1, (22 - (rel?.range ?? 15)) / 7)));
        cam(L(1.2, 1.02, u), 0.1, L(32, 26, u));
        step(3);
        return g().sim.docked ? 'done' : `range ${rel?.range.toFixed(1)}`;
      },
    },
    P: {
      setup() { g().start(7); H.hud('labels'); H.view(true); g().rig.mapZoom = 1.0; g().advance(40, H.DT); },
      frame(f, n) { g().rig.mapZoom = L(0.95, 1.3, E(f / (n - 1))); step(); },
    },
    Q: {
      setup() {
        g().start(8); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().director.phase?.name === 'ENTRY' && g().sim.altitude < 40000, 30, 6000, true, 10);
      },
      frame(f, n) { cam(L(1.55, 1.3, E(f / (n - 1))), 0.06, L(19, 23, E(f / (n - 1)))); step(2); return `g ${g().sim.gLoad.toFixed(1)} alt ${(g().sim.altitude / 1e3).toFixed(1)}`; },
    },
    // R → S: one flight; record in one run, in that order.
    R: {
      setup() {
        g().start(8); H.hud(false); H.view(false); H.auto(true);
        H.flyUntil(() => g().sim.chutes === 'mains' && g().sim.chuteOpen > 0.55, 30, 6000, true, 10);
      },
      frame(f, n) { const u = E(f / (n - 1)); cam(L(0.2, 0.55, u), L(0.62, 0.5, u), L(150, 120, u)); step(1.5); },
    },
    S: {
      setup() { H.hud(false); H.flyUntil(() => g().sim.outcome?.kind === 'splashdown', 30, 6000, false, 10); },
      frame(f, n) {
        const u = f / (n - 1);
        const dist = 60 * Math.pow(2.6e7 / 60, E(Math.min(1, u * 1.08)));
        cam(L(0.5, 1.1, E(u)), L(0.45, 0.7, E(u)), dist);
        g().advance(1, H.DT);
        // Splashed down, the game swaps the globe for the local patch; out here, swap it back.
        if (dist > 80e3) {
          const w = g().world;
          w.earthPatch.group.visible = false;
          for (const c of w.earth.children) if (c.isLineSegments2) c.visible = true;
          g().stage.render();
        }
      },
    },
  };
})();
