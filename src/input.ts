import type { RotationInput, TranslationInput } from './sim/spacecraft';

/** Discrete commands (edge-triggered keys). */
export type Command =
  | 'warp-up' | 'warp-down' | 'warp-next'
  | 'throttle-full' | 'throttle-cut'
  | 'hold' | 'sas' | 'auto'
  | 'map' | 'focus' | 'help'
  | 'enter' | 'restart' | 'menu' | 'replan' | 'continue'
  | 'up' | 'down' | 'left' | 'right';

const COMMANDS: Record<string, Command> = {
  Period: 'warp-up',
  Comma: 'warp-down',
  KeyG: 'warp-next',
  KeyZ: 'throttle-full',
  KeyX: 'throttle-cut',
  KeyF: 'hold',
  KeyT: 'sas',
  KeyB: 'auto',
  KeyM: 'map',
  Tab: 'focus',
  KeyH: 'help',
  Enter: 'enter',
  NumpadEnter: 'enter',
  KeyR: 'restart',
  KeyC: 'continue',
  Escape: 'menu',
  Backspace: 'replan',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Keyboard: held keys become continuous stick/throttle/RCS inputs;
 * presses queue discrete commands for the frame loop to consume.
 */
export class Input {
  private readonly held = new Set<string>();
  private queue: Command[] = [];
  onFirstKey: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.onFirstKey?.();
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backspace') e.preventDefault();
      this.held.add(e.code);
      const cmd = COMMANDS[e.code];
      if (cmd && !e.repeat) this.queue.push(cmd);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Commands pressed since the last call. */
  drain(): Command[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  private axis(neg: string, pos: string): number {
    return (this.held.has(pos) ? 1 : 0) - (this.held.has(neg) ? 1 : 0);
  }

  get rotation(): RotationInput {
    return { pitch: this.axis('KeyS', 'KeyW'), yaw: this.axis('KeyD', 'KeyA'), roll: this.axis('KeyE', 'KeyQ') };
  }

  /** RCS translation, body frame: I/K fore-aft, J/L left-right, U/O up-down. */
  get translation(): TranslationInput {
    return { x: this.axis('KeyJ', 'KeyL'), y: this.axis('KeyO', 'KeyU'), z: this.axis('KeyK', 'KeyI') };
  }

  get throttleRate(): number {
    const up = this.held.has('ShiftLeft') || this.held.has('ShiftRight');
    const down = this.held.has('ControlLeft') || this.held.has('ControlRight');
    return (up ? 1 : 0) - (down ? 1 : 0);
  }

  /** Is the pilot touching the stick, RCS or throttle right now? */
  get manual(): boolean {
    const r = this.rotation;
    const t = this.translation;
    return r.pitch !== 0 || r.yaw !== 0 || r.roll !== 0 || t.x !== 0 || t.y !== 0 || t.z !== 0 || this.throttleRate !== 0;
  }

  get steering(): boolean {
    const r = this.rotation;
    return r.pitch !== 0 || r.yaw !== 0 || r.roll !== 0;
  }
}
