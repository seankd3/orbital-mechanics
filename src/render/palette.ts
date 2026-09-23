import { Color } from 'three';

/**
 * Mission-control vector palette: crisp lines on black, color only where
 * it carries meaning (nominal / plan / target / warning).
 */
export const INK = new Color('#d9e4df'); // primary lines, your craft
export const DIM = new Color('#6f817a');
export const FAINT = new Color('#24302c'); // graticules
export const EARTH_LINE = new Color('#59c486'); // coastlines
export const MOON_LINE = new Color('#9fb0a9');
export const TRACK = new Color('#7fdca0'); // current trajectory
export const PLAN = new Color('#ffb547'); // planned burn and its outcome
export const TARGET = new Color('#6fd3ff'); // the partner craft
export const WARN = new Color('#ff5a4f');
export const VOID = new Color('#030506');
