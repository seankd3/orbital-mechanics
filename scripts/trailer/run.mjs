// Trailer recorder. Usage:
//   node run.mjs probe <name>          stills from a probe in shots.js
//   node run.mjs record <shot> [...]   frames for shots (JPEG) into frames/<shot>/
import fs from 'node:fs';
import path from 'node:path';
import { TIMELINE } from './timeline.mjs';
// Playwright: the project's, or a global install via PLAYWRIGHT=/path/to/playwright/index.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [mode, ...names] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('[tr]')) && console.log('page:', m.text()));
await page.route('**/__trailer/jbmono.woff2', (r) => r.fulfill({ path: path.join(HERE, 'jbmono.woff2'), contentType: 'font/woff2' }));
await page.goto('http://localhost:5175/');
await page.waitForTimeout(2500);
await page.evaluate(() => (window.requestAnimationFrame = () => 0));
await page.addScriptTag({ path: path.join(HERE, 'lib.js') });
await page.addScriptTag({ path: path.join(HERE, 'shots.js') });
await page.evaluate(() => document.fonts.load('400 20px JB'));
await page.evaluate((T) => (window.TIMELINE = T), TIMELINE);

if (mode === 'probe') {
  for (const name of names) {
    fs.mkdirSync(path.join(HERE, 'probe'), { recursive: true });
    const n = await page.evaluate((name) => window.PROBES[name].length ?? 0, name);
    await page.evaluate((name) => {
      const stage = window.__game.stage;
      stage.render = () => {};
      try { return window.PROBES[name].setup(); } finally { delete stage.render; }
    }, name);
    for (let i = 0; i < n; i++) {
      const info = await page.evaluate(([name, i]) => window.PROBES[name].still(i), [name, i]);
      await page.screenshot({ path: path.join(HERE, 'probe', `${name}-${i}.jpg`), type: 'jpeg', quality: 88 });
      console.log(name, i, info ?? '');
    }
  }
} else if (mode === 'record') {
  // Frames only: all typography is composited later from the overlay pass.
  for (const id of names) {
    const shot = TIMELINE.shots.find((s) => s.id === id);
    const dir = path.join(HERE, 'frames', id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const tail = await page.evaluate((id) => !!window.SHOTS[id].tail, id);
    const frames = tail ? 30 * 90 : Math.round(shot.dur * 30);
    const t0 = Date.now();
    // No draws during setup: queued software-GL frames would stall the first screenshot.
    const info = await page.evaluate((id) => {
      const stage = window.__game.stage;
      stage.render = () => {};
      try { return window.SHOTS[id].setup(); } finally { delete stage.render; }
    }, id);
    console.log(`${id}: setup ${((Date.now() - t0) / 1000).toFixed(0)} s`, info ?? '');
    let f = 0;
    for (; f < frames; f++) {
      const log = await page.evaluate(([id, f, frames]) => window.SHOTS[id].frame(f, frames), [id, f, frames]);
      await page.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (log && f % 30 === 0) console.log(`  ${id} ${f}/${frames}`, log);
      if (log === 'done') break;
    }
    console.log(`${id}: ${f} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
