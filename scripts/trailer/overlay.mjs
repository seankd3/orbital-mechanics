// Typography pass: every trailer frame's titles, slates, subtitles and fades
// as transparent PNGs (identical frames are hard-linked, not re-rendered).
import fs from 'node:fs';
import path from 'node:path';
import { TIMELINE } from './timeline.mjs';
// Playwright: the project's, or a global install via PLAYWRIGHT=/path/to/playwright/index.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(HERE, 'overlay');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route('**/__trailer/jbmono.woff2', (r) => r.fulfill({ path: path.join(HERE, 'jbmono.woff2'), contentType: 'font/woff2' }));
await page.route('http://trailer.local/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:transparent"></body></html>' }));
await page.goto('http://trailer.local/');
await page.addScriptTag({ path: path.join(HERE, 'lib.js') });
await page.evaluate(() => document.fonts.load('400 20px JB'));
await page.evaluate((T) => (window.TIMELINE = T), TIMELINE);

const total = Math.round(TIMELINE.total * TIMELINE.fps);
let prevKey = null;
let prevFile = null;
let rendered = 0;
for (let f = 0; f < total; f++) {
  const key = await page.evaluate((f) => {
    const T = window.TIMELINE;
    const t = f / T.fps;
    const shot = T.shots.find((s) => t >= s.start && t < s.start + s.dur) ?? T.shots[T.shots.length - 1];
    document.body.classList.toggle('tr-hud', !!shot.hud);
    window.TR.overlays(T, t, shot);
    const ids = ['tr-black', 'tr-title', 'tr-slate', 'tr-feature', 'tr-sub'];
    return ids.map((id) => { const el = document.getElementById(id); return `${(+el.style.opacity || 0).toFixed(3)}|${el.innerHTML.length}|${el.textContent.slice(0, 40)}`; }).join('#') + (shot.hud ? 'H' : '');
  }, f);
  const file = path.join(dir, `${String(f).padStart(6, '0')}.png`);
  if (key === prevKey) fs.linkSync(prevFile, file);
  else {
    await page.screenshot({ path: file, omitBackground: true });
    rendered++;
  }
  prevKey = key;
  prevFile = file;
}
console.log(`overlay: ${total} frames, ${rendered} rendered`);
await browser.close();
