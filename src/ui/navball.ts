import { Quaternion, Vector3 } from 'three';
import { orbitalFrame } from '../sim/physics';

const SIZE = 196;
const C = SIZE / 2;
const RADIUS = SIZE * 0.42;

const COL = {
  ink: '#d9e4df',
  dim: '#6f817a',
  faint: '#24302c',
  track: '#7fdca0',
  plan: '#ffb547',
  target: '#6fd3ff',
};

type Style = 'pro' | 'retro' | 'hollow' | 'solid' | 'cue' | 'target';

export interface NavballState {
  quaternion: Quaternion;
  position: Vector3;
  velocity: Vector3;
  /** Guidance cue direction (world). */
  cue?: Vector3 | null;
  /** Partner craft, relative to us: position and velocity. */
  target?: { pos: Vector3; vel: Vector3 } | null;
  /** Entry: current and wanted bank (rad). */
  bank?: { current: number; target: number } | null;
}

/**
 * Flight-director ball drawn in the thrust frame: the center is where the
 * engine points, so putting the ◇ cue on the reticle is "on attitude".
 */
export class Navball {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(SIZE * dpr);
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    parent.appendChild(canvas);
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  update(s: NavballState): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.font = '9px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const inv = s.quaternion.clone().invert();
    const local = (v: Vector3) => v.clone().normalize().applyQuaternion(inv);

    this.shell();
    const f = orbitalFrame(s.position, s.velocity);
    this.horizon(local(f.radial));
    this.marker(local(f.prograde), 'pro', 'PRO', COL.ink);
    this.marker(local(f.prograde.clone().negate()), 'retro', 'RET', COL.dim);
    this.marker(local(f.normal), 'solid', 'N', COL.dim);
    this.marker(local(f.normal.clone().negate()), 'hollow', 'AN', COL.dim);
    this.marker(local(f.radial), 'solid', 'RAD', COL.dim);
    this.marker(local(f.radial.clone().negate()), 'hollow', 'IN', COL.dim);
    if (s.target && s.target.pos.lengthSq() > 1) {
      this.marker(local(s.target.pos), 'target', 'TGT', COL.target);
      if (s.target.vel.lengthSq() > 1e-4) {
        // Our velocity relative to the target: fly it onto TGT to close.
        const rel = s.target.vel.clone().negate();
        this.marker(local(rel), 'pro', 'V REL', COL.target);
      }
    }
    if (s.cue) this.marker(local(s.cue), 'cue', '', COL.plan);
    if (s.bank) this.bankDial(s.bank.current, s.bank.target);
    this.reticle();
  }

  private shell(): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL.faint;
    ctx.beginPath();
    ctx.arc(C, C, RADIUS * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COL.dim;
    ctx.beginPath();
    ctx.arc(C, C, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r0 = RADIUS - (i % 9 === 0 ? 7 : 3);
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
      ctx.lineTo(C + Math.cos(a) * RADIUS, C + Math.sin(a) * RADIUS);
      ctx.stroke();
    }
  }

  /** The local horizontal plane as a great circle (front solid, back faint). */
  private horizon(up: Vector3): void {
    let u = new Vector3().crossVectors(up, new Vector3(0, 0, 1));
    if (u.lengthSq() < 1e-6) u = new Vector3().crossVectors(up, new Vector3(0, 1, 0));
    u.normalize();
    const v = new Vector3().crossVectors(up, u).normalize();
    for (const front of [false, true]) {
      const ctx = this.ctx;
      ctx.strokeStyle = front ? COL.track : COL.faint;
      ctx.globalAlpha = front ? 0.7 : 1;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        const p = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
        if (p.z >= 0 !== front) {
          pen = false;
          continue;
        }
        const x = C + p.x * RADIUS;
        const y = C - p.y * RADIUS;
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private marker(p: Vector3, style: Style, label: string, color: string): void {
    const ctx = this.ctx;
    const front = p.z >= 0;
    // Behind you: pin to the rim so it's still findable.
    const k = front ? 1 : 1 / Math.max(1e-6, Math.hypot(p.x, p.y));
    const x = C + p.x * k * RADIUS * (front ? 1 : 0.97);
    const y = C - p.y * k * RADIUS * (front ? 1 : 0.97);
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.35;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = style === 'cue' ? 1.6 : 1;
    ctx.beginPath();
    switch (style) {
      case 'pro':
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.moveTo(x - 9, y);
        ctx.lineTo(x - 5, y);
        ctx.moveTo(x + 5, y);
        ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y - 9);
        break;
      case 'retro':
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.moveTo(x - 3.5, y - 3.5);
        ctx.lineTo(x + 3.5, y + 3.5);
        ctx.moveTo(x + 3.5, y - 3.5);
        ctx.lineTo(x - 3.5, y + 3.5);
        break;
      case 'solid':
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x + 5, y + 4);
        ctx.lineTo(x - 5, y + 4);
        ctx.closePath();
        break;
      case 'hollow':
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        break;
      case 'target':
        ctx.rect(x - 5, y - 5, 10, 10);
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x, y + 9);
        break;
      case 'cue':
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        break;
    }
    ctx.stroke();
    if (label) ctx.fillText(label, x, y + (y > C + RADIUS * 0.75 ? -15 : 15));
    ctx.restore();
  }

  /** Entry bank dial along the top of the ball: needle = lift vector, tick = guidance. */
  private bankDial(current: number, target: number): void {
    const ctx = this.ctx;
    const r = RADIUS + 9;
    const at = (bank: number) => -Math.PI / 2 + bank;
    ctx.save();
    ctx.strokeStyle = COL.faint;
    ctx.beginPath();
    ctx.arc(C, C, r, -Math.PI, 0);
    ctx.stroke();
    const side = current >= 0 ? 1 : -1;
    ctx.strokeStyle = COL.plan;
    ctx.lineWidth = 2;
    const t = at(side * target);
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(t) * (r - 5), C + Math.sin(t) * (r - 5));
    ctx.lineTo(C + Math.cos(t) * (r + 5), C + Math.sin(t) * (r + 5));
    ctx.stroke();
    ctx.strokeStyle = COL.ink;
    const a = at(current);
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  private reticle(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C - 16, C);
    ctx.lineTo(C - 6, C);
    ctx.lineTo(C, C + 5);
    ctx.lineTo(C + 6, C);
    ctx.lineTo(C + 16, C);
    ctx.stroke();
  }
}
