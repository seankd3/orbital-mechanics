// Injected into the game page: drives the sim frame by frame for the trailer
// and draws the trailer's own typography (titles, slates, subtitles, fades).
(() => {
  const g = () => window.__game;
  const DT = 1 / 30;

  // ---------- typography overlay ----------
  const css = `
  @font-face { font-family: 'JB'; src: url('/__trailer/jbmono.woff2') format('woff2'); font-weight: 100 800; }
  :root { --mono: 'JB', 'JetBrains Mono', monospace !important; }
  #toasts, #help, .hint, #overlay, #auto { display: none !important; }
  body.tr-clean #ui { display: none !important; }
  body.tr-labels #ui > *:not(.labels) { display: none !important; }
  #tr { position: fixed; inset: 0; pointer-events: none; z-index: 9999; font-family: 'JB', monospace; text-transform: uppercase; color: #d9e4df; }
  #tr-black { position: absolute; inset: 0; background: #030506; opacity: 0; }
  #tr-title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; }
  #tr-title .big { font-size: 132px; font-weight: 300; letter-spacing: 0.62em; padding-left: 0.62em; line-height: 1; }
  #tr-title .rule { width: 180px; height: 1px; background: #ffb547; margin: 44px 0 34px; opacity: 0.9; }
  #tr-title .sub { font-size: 21px; font-weight: 400; letter-spacing: 0.5em; padding-left: 0.5em; color: #9fb0a9; }
  #tr-title .small { margin-top: 26px; font-size: 15px; letter-spacing: 0.42em; padding-left: 0.42em; color: #6f817a; }
  #tr-title .url { margin-top: 70px; font-size: 19px; letter-spacing: 0.3em; padding-left: 0.3em; color: #ffb547; }
  #tr-title .credit { position: absolute; bottom: 58px; font-size: 12px; letter-spacing: 0.3em; color: #4f5f59; text-transform: none; }
  #tr-slate { position: absolute; left: 72px; bottom: 76px; opacity: 0; }
  #tr-slate .rule { width: 260px; height: 1px; background: #24302c; margin-bottom: 16px; }
  #tr-slate .n { color: #ffb547; font-size: 15px; letter-spacing: 0.3em; margin-right: 18px; }
  #tr-slate .t { font-size: 15px; letter-spacing: 0.38em; }
  #tr-feature { position: absolute; top: 84px; left: 0; right: 0; text-align: center; font-size: 17px; letter-spacing: 0.46em; color: #9fb0a9; opacity: 0; }
  #tr-sub { position: absolute; left: 50%; transform: translateX(-50%); width: 1500px; text-align: center; opacity: 0; bottom: 118px; }
  body.tr-hud #tr-sub { bottom: 300px; }
  #tr-sub .who { font-size: 13px; letter-spacing: 0.42em; color: #ffb547; margin-bottom: 14px; }
  #tr-sub .said { font-size: 27px; letter-spacing: 0.07em; line-height: 1.45; text-shadow: 0 0 18px #030506, 0 0 6px #030506; }
  `;
  const root = document.createElement('div');
  root.id = 'tr';
  root.innerHTML = `<div id="tr-black"></div><div id="tr-feature"></div><div id="tr-slate"></div><div id="tr-sub"></div><div id="tr-title"></div>`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  document.body.append(root);
  const $ = (id) => document.getElementById(id);

  const ramp = (t, a, b, fin = 0.35, fout = 0.35) =>
    t < a || t > b ? 0 : Math.min(1, fin ? (t - a) / fin : 1, fout ? (b - t) / fout : 1);
  const cache = {};
  const set = (id, html) => {
    if (cache[id] !== html) $(id).innerHTML = cache[id] = html;
  };

  /** Draw every overlay for global trailer time t (seconds). */
  function overlays(T, t, shot) {
    // Fades: shot fade-in / fade-out, and black cards.
    let black = 0;
    if (shot.fadeIn) black = Math.max(black, 1 - Math.min(1, (t - shot.start) / shot.fadeIn));
    if (shot.fadeOut) black = Math.max(black, 1 - Math.min(1, (shot.start + shot.dur - t) / shot.fadeOut));
    if (shot.black) black = 1;
    $('tr-black').style.opacity = black;

    const title = T.cards.find((c) => c.kind === 'title' && t >= c.at && t <= c.at + c.dur);
    if (title) set('tr-title', title.html);
    $('tr-title').style.opacity = title ? ramp(t, title.at, title.at + title.dur, title.fin ?? 0.9, title.fout ?? 0.9) : 0;

    const slate = T.cards.find((c) => c.kind === 'slate' && t >= c.at && t <= c.at + c.dur);
    if (slate) set('tr-slate', `<div class="rule"></div><span class="n">${slate.n}</span><span class="t">${slate.text}</span>`);
    $('tr-slate').style.opacity = slate ? ramp(t, slate.at, slate.at + slate.dur, 0.5, 0.5) : 0;

    const feat = T.cards.find((c) => c.kind === 'feature' && t >= c.at && t <= c.at + c.dur);
    if (feat) set('tr-feature', feat.text);
    $('tr-feature').style.opacity = feat ? ramp(t, feat.at, feat.at + feat.dur, 0.6, 0.6) : 0;

    // Subtitles: the line being said (held briefly after it ends).
    const line = T.voice.find((v) => v.text && t >= v.at - 0.05 && t <= v.at + v.len + 0.6);
    if (line) set('tr-sub', `<div class="who">${line.who}</div><div class="said">“${line.text}”</div>`);
    $('tr-sub').style.opacity = line ? ramp(t, line.at - 0.05, line.at + line.len + 0.6, 0.15, 0.3) : 0;
  }

  // ---------- flight helpers ----------
  const H = {
    g,
    DT,
    get d() { return g().director; },
    get sim() { return g().sim; },
    get rig() { return g().rig; },
    /** Fly (no drawing between) until pred() is true; G through coasts. */
    flyUntil(pred, k = 120, max = 4000, warpNext = true, warp = 1) {
      for (let i = 0; i < max && !pred(); i++) {
        const d = g().director;
        const sim = g().sim;
        if (warpNext && d && d.nextEvent !== null && !sim.ship.firing && sim.met < d.nextEvent - 1) g().command('warp-next');
        else if (sim.warpUntil === null) sim.warp = warp;
        g().advance(k, DT);
      }
      if (!pred()) throw new Error('flyUntil: predicate never met');
    },
    auto(on = true) { if (!!g().director.auto !== on) g().command('auto'); },
    view(map) { if ((g().rig.mode === 'map') !== map) g().command('map'); },
    /** true: the game's HUD; false: clean frame; 'labels': map labels only. */
    hud(on) {
      const b = document.body.classList;
      b.toggle('tr-clean', on === false);
      b.toggle('tr-labels', on === 'labels');
      b.toggle('tr-hud', on === true);
    },
    lerp: (a, b, u) => a + (b - a) * u,
    ease: (u) => u * u * (3 - 2 * u),
  };

  window.TR = { overlays, H };
})();
