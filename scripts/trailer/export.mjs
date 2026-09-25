import fs from 'node:fs';
import { TIMELINE } from './timeline.mjs';
fs.writeFileSync(new URL('./timeline.json', import.meta.url), JSON.stringify(TIMELINE, null, 1));
console.log('shots', TIMELINE.shots.length, 'voice', TIMELINE.voice.length, 'total', TIMELINE.total);
