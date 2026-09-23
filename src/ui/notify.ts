import type { Tone } from '../sim/simulation';

const HOLD_MS = 3200;
const MAX = 3;

/** Sparse event toasts above the instruments. */
export function notify(message: string, tone: Tone = 'info'): void {
  const host = document.getElementById('toasts')!;
  if ([...host.children].some((c) => c.textContent === message)) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('fade'), HOLD_MS);
  setTimeout(() => toast.remove(), HOLD_MS + 700);
  while (host.children.length > MAX) host.firstChild?.remove();
}
