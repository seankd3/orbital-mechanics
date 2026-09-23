// Fly Apollo 11 end to end in a real browser through the dev hook
// (window.__game) and screenshot every chapter.
//
//   npm run dev &
//   node scripts/fly-mission.mjs [outDir] [url]
//
// Needs Playwright with Chromium. PLAYWRIGHT=/path/to/playwright/index.mjs
// points at a global install; software GL flags keep it working headless.
import fs from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const dir = process.argv[2] ?? 'shots';
const url = process.argv[3] ?? 'http://localhost:5175/';
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.waitForTimeout(2500);
await page.evaluate(() => (window.requestAnimationFrame = () => 0)); // the script owns the clock

const run = (fn, arg) => page.evaluate(fn, arg);
const state = () =>
  run(() => {
    const { director: d, sim, mode } = window.__game;
    return {
      mode, id: d?.chapter.id, phase: d?.phase?.name ?? null, next: d?.nextEvent ?? null,
      met: sim.met, alt: sim.altitude, firing: sim.ship.firing, lit: d?.guide ? d.guide.litAt !== null : null,
      range: sim.relative()?.range ?? null, g: sim.gLoad, failure: d?.failure ?? null, grade: d?.grade ?? null,
    };
  });
const cmd = (c) => run((c) => window.__game.command(c), c);
const advance = (k, dt = 1 / 30) => run(([k, dt]) => window.__game.advance(k, dt), [k, dt]);
let n = 0;
const shot = async (name) => {
  await advance(1);
  await page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-${name}.png` });
};
const view = async (map) => {
  const isMap = await run(() => window.__game.rig.mode === 'map');
  if (isMap !== map) await cmd('map');
  if (map) for (let i = 0; i < 6; i++) await advance(1, 0.2); // let the map camera ease in
};

// Moments worth a picture, per chapter.
const moments = {
  tli: [['burning', (s) => s.lit && s.firing]],
  loi: [['burning', (s) => s.lit && s.firing]],
  descent: [['braking', (s) => s.phase === 'DESCENT' && s.alt < 9000], ['p66', (s) => s.phase === 'DESCENT' && s.alt < 150]],
  ascent: [['liftoff', (s) => s.phase === 'ASCENT' && s.alt > 400]],
  rendezvous: [['prox', (s) => s.phase === 'DOCKING' && s.range < 400]],
  entry: [['entry', (s) => s.phase === 'ENTRY' && s.g > 3], ['chutes', (s) => s.phase === 'ENTRY' && s.alt < 3000]],
};

await shot('menu');
await page.keyboard.press('Enter');
await run(() => window.__game.update(0.016)); // drain the key
await page.waitForTimeout(1500);

for (let ch = 0; ch < 9; ch++) {
  let s = await state();
  await view(false);
  await shot(`${s.id}-chase`);
  await view(true);
  await shot(`${s.id}-map`);
  await view(false);
  await cmd('auto');
  const todo = [...(moments[s.id] ?? [])];
  for (let guard = 0; guard < 4000; guard++) {
    s = await state();
    if (s.mode !== 'flying') break;
    if (todo.length && todo[0][1](s)) await shot(`${s.id}-${todo.shift()[0]}`);
    if (s.next !== null && !s.firing && s.met < s.next - 1) await cmd('warp-next');
    await advance(['DESCENT', 'DOCKING', 'ENTRY'].includes(s.phase) ? 40 : 200);
  }
  s = await state();
  console.log(`${s.id.padEnd(11)} ${s.mode.padEnd(8)} ★${s.grade?.stars ?? 0}  ${s.failure ?? s.grade?.lines.map((l) => `${l.label} ${l.value}`).join(' · ')}`);
  await shot(`${s.id}-${s.mode}`);
  if (s.mode !== 'debrief') break;
  await cmd('enter');
}
const final = await state();
if (final.mode === 'finale') await shot('finale');
console.log(final.mode === 'finale' ? 'SPLASHDOWN — mission complete' : `stopped in ${final.mode}`);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(final.mode === 'finale' && !errors.length ? 0 : 1);
