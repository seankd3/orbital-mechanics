import type { RotationInput } from './sim/spacecraft';

export interface InputHandlers {
  onWarpUp(): void;
  onWarpDown(): void;
  onToggleSas(): void;
  onReset(): void;
  onToggleHelp(): void;
  onMaxThrottle(): void;
  onCutThrottle(): void;
}

export class Input {
  private readonly keys = new Set<string>();

  constructor(handlers: InputHandlers) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      switch (e.code) {
        case 'Period': handlers.onWarpUp(); break;
        case 'Comma': handlers.onWarpDown(); break;
        case 'KeyT': handlers.onToggleSas(); break;
        case 'KeyR': handlers.onReset(); break;
        case 'KeyH': handlers.onToggleHelp(); break;
        case 'KeyZ': handlers.onMaxThrottle(); break;
        case 'KeyX': handlers.onCutThrottle(); break;
        case 'Space': e.preventDefault(); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get rotation(): RotationInput {
    const axis = (neg: string, pos: string) =>
      (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    return {
      pitch: axis('KeyS', 'KeyW'),
      yaw: axis('KeyD', 'KeyA'),
      roll: axis('KeyE', 'KeyQ'),
    };
  }

  get burn(): boolean {
    return this.keys.has('Space');
  }

  get throttleDelta(): number {
    return (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0) -
      (this.keys.has('ControlLeft') || this.keys.has('ControlRight') ? 1 : 0);
  }
}
