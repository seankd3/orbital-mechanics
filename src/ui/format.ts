/** Display helpers — everything the HUD prints goes through here. */

export function fmtDistance(meters: number): string {
  if (!isFinite(meters)) return '—';
  const km = meters / 1000;
  if (Math.abs(km) >= 100_000) return `${(km / 1000).toFixed(1)} Mm`;
  return `${km.toLocaleString('en-US', { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
}

export function fmtSpeed(ms: number): string {
  if (!isFinite(ms)) return '—';
  return `${ms.toLocaleString('en-US', { maximumFractionDigits: 0 })} m/s`;
}

export function fmtPeriod(seconds: number): string {
  if (!isFinite(seconds)) return 'ESCAPE';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${pad(m)}:${pad(s)}`;
}

export function fmtMet(seconds: number): string {
  const total = Math.floor(seconds);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const core = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `T+${d}d ${core}` : `T+${core}`;
}

export function fmtWarp(warp: number): string {
  return warp >= 1000 ? `${warp / 1000}k×` : `${warp}×`;
}

export function fmtDegrees(rad: number): string {
  return `${((rad * 180) / Math.PI).toFixed(1)}°`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
