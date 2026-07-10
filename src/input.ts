import type { RotationInput, TranslationInput } from './sim/spacecraft';

export interface InputHandlers {
  onWarpUp(): void;
  onWarpDown(): void;
  onToggleSas(): void;
  onReset(): void;
  onToggleHelp(): void;
  onMaxThrottle(): void;
  onCutThrottle(): void;
  onToggleNode(): void;
  onExecuteNode(): void;
  onNodeDv(delta: number): void;
  onNodeTig(delta: number): void;
  onToggleMap(): void;
  onSwitchCraft(): void;
  onAnyKey(): void;
}

export class Input {
  private readonly keys = new Set<string>();

  constructor(handlers: InputHandlers) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      handlers.onAnyKey();
      this.keys.add(e.code);
      switch (e.code) {
        case 'Period': handlers.onWarpUp(); break;
        case 'Comma': handlers.onWarpDown(); break;
        case 'KeyT': handlers.onToggleSas(); break;
        case 'KeyR': handlers.onReset(); break;
        case 'KeyH': handlers.onToggleHelp(); break;
        case 'KeyZ': handlers.onMaxThrottle(); break;
        case 'KeyX': handlers.onCutThrottle(); break;
        case 'KeyN': handlers.onToggleNode(); break;
        case 'KeyB': handlers.onExecuteNode(); break;
        case 'KeyM': handlers.onToggleMap(); break;
        case 'KeyV': handlers.onSwitchCraft(); break;
        // [ ] adjust node ΔV; with Shift ({ }) they adjust node TIG.
        case 'BracketLeft':
          if (e.shiftKey) handlers.onNodeTig(-60); else handlers.onNodeDv(-10);
          break;
        case 'BracketRight':
          if (e.shiftKey) handlers.onNodeTig(60); else handlers.onNodeDv(10);
          break;
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

  /** RCS translation, body frame: I/K fore-aft, J/L left-right, U/O up-down. */
  get translation(): TranslationInput {
    const axis = (neg: string, pos: string) =>
      (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    return {
      x: axis('KeyJ', 'KeyL'),
      y: axis('KeyO', 'KeyU'),
      z: axis('KeyK', 'KeyI'),
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
