type Tone = 'ok' | 'warn' | 'bad';

const HOLD_MS = 2600;

export function notify(message: string, tone: Tone = 'ok'): void {
  const host = document.getElementById('notify')!;
  const toast = document.createElement('div');
  toast.className = `toast${tone === 'ok' ? '' : ` ${tone}`}`;
  toast.textContent = message;
  host.appendChild(toast);

  setTimeout(() => toast.classList.add('fade'), HOLD_MS);
  setTimeout(() => toast.remove(), HOLD_MS + 700);

  // Keep the stack short.
  while (host.children.length > 3) host.firstChild?.remove();
}
