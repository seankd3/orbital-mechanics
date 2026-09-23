/** Display helpers — everything CAPCOM and the HUD print goes through here. */

export function km(meters: number, digits = 0): string {
  if (!isFinite(meters)) return '∞';
  const k = meters / 1000;
  return `${k.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} KM`;
}

/** Distance that reads well from docking range to cislunar space. */
export function range(meters: number): string {
  if (!isFinite(meters)) return '—';
  if (Math.abs(meters) < 10_000) return `${Math.round(meters).toLocaleString('en-US')} M`;
  return km(meters, Math.abs(meters) < 100_000 ? 1 : 0);
}

export function speed(ms: number, digits = 0): string {
  if (!isFinite(ms)) return '—';
  return `${ms.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} M/S`;
}

/** Clock-style duration: 04:12, 1:04:12, 2D 01:04:12. */
export function clock(seconds: number): string {
  if (!isFinite(seconds)) return '—';
  const t = Math.max(0, Math.floor(seconds));
  const d = Math.floor(t / 86_400);
  const h = Math.floor((t % 86_400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mmss = `${pad(m)}:${pad(s)}`;
  if (d > 0) return `${d}D ${pad(h)}:${mmss}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** Mission elapsed time, Apollo style: 075:49:32. */
export function met(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(t / 3600)).padStart(3, '0')}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

export function degrees(rad: number, digits = 1): string {
  return `${((rad * 180) / Math.PI).toFixed(digits)}°`;
}

export function warp(w: number): string {
  if (w >= 1000) return `${(w / 1000).toLocaleString('en-US')}K×`;
  return `${Math.round(w)}×`;
}

export function signed(v: number, digits = 1): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
