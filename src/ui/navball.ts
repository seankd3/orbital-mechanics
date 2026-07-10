import { Quaternion, Vector3 } from 'three';

interface Marker {
  label: string;
  style: 'solid' | 'hollow' | 'cross';
  local: Vector3;
}

const SIZE = 156;

/**
 * Vector-line navball (ported from the Apollo build): orbital frame markers
 * (prograde/retrograde, normal/anti-normal, radial in/out, maneuver cue)
 * projected into the craft's boresight frame on a 2D canvas.
 */
export class Navball {
  private readonly ctx: CanvasRenderingContext2D;
  private markers: Marker[] = [];
  private horizonNormal: Vector3 | null = null;

  constructor() {
    const wrapper = document.createElement('div');
    wrapper.id = 'navball';
    document.body.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(SIZE * dpr);
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    wrapper.appendChild(canvas);
    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(
    position: Vector3,
    velocity: Vector3,
    quaternion: Quaternion,
    maneuverDir: Vector3 | null,
  ): void {
    if (position.lengthSq() < 1e-10 || velocity.lengthSq() < 1e-10) return;

    const prograde = velocity.clone().normalize();
    const normal = new Vector3().crossVectors(position, velocity).normalize();
    if (normal.lengthSq() < 1e-10) return;
    const radialOut = new Vector3().crossVectors(prograde, normal).normalize();

    const inv = quaternion.clone().invert();
    this.horizonNormal = radialOut.clone().applyQuaternion(inv).normalize();

    const raw: { label: string; style: Marker['style']; vector: Vector3 }[] = [
      { label: 'PRO', style: 'solid', vector: prograde },
      { label: 'RET', style: 'hollow', vector: prograde.clone().negate() },
      { label: 'N', style: 'solid', vector: normal },
      { label: 'AN', style: 'hollow', vector: normal.clone().negate() },
      { label: 'RAD', style: 'solid', vector: radialOut },
      { label: 'IN', style: 'hollow', vector: radialOut.clone().negate() },
    ];
    if (maneuverDir && maneuverDir.lengthSq() > 1e-10) {
      raw.push({ label: 'MNV', style: 'cross', vector: maneuverDir.clone().normalize() });
    }
    this.markers = raw.map((m) => ({
      label: m.label,
      style: m.style,
      local: m.vector.applyQuaternion(inv).normalize(),
    }));

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    const center = SIZE / 2;
    const radius = SIZE * 0.43;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineCap = 'square';
    ctx.font = '10px "IBM Plex Mono", "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.drawShell(center, radius);
    this.drawHorizon(center, radius);
    for (const marker of this.markers) this.drawMarker(center, radius, marker);
    this.drawReticle(center);
  }

  private drawShell(center: number, radius: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#7dffa8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.58, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const inner = radius - (i % 3 === 0 ? 8 : 4);
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHorizon(center: number, radius: number): void {
    if (!this.horizonNormal) return;
    const normal = this.horizonNormal;
    let u = new Vector3().crossVectors(normal, new Vector3(0, 0, 1));
    if (u.lengthSq() < 1e-4) u = new Vector3().crossVectors(normal, new Vector3(0, 1, 0));
    u.normalize();
    const v = new Vector3().crossVectors(normal, u).normalize();
    this.drawHorizonArc(center, radius, u, v, true);
    this.drawHorizonArc(center, radius, u, v, false);
  }

  private drawHorizonArc(center: number, radius: number, u: Vector3, v: Vector3, front: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = front ? '#ffffff' : '#3f9c60';
    ctx.globalAlpha = front ? 0.85 : 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= 144; i++) {
      const t = (i / 144) * Math.PI * 2;
      const p = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
      if (p.z >= 0 !== front) {
        drawing = false;
        continue;
      }
      const x = center + p.x * radius;
      const y = center - p.y * radius;
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawReticle(center: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center - 11, center);
    ctx.lineTo(center - 4, center);
    ctx.moveTo(center + 4, center);
    ctx.lineTo(center + 11, center);
    ctx.moveTo(center, center - 11);
    ctx.lineTo(center, center - 4);
    ctx.moveTo(center, center + 4);
    ctx.lineTo(center, center + 11);
    ctx.stroke();
    ctx.restore();
  }

  private drawMarker(center: number, radius: number, marker: Marker): void {
    const ctx = this.ctx;
    const v = marker.local;
    const visible = v.z >= -0.05;
    const clamp = visible ? 1 : 0.96;
    const x = center + Math.max(-clamp, Math.min(clamp, v.x)) * radius;
    const y = center - Math.max(-clamp, Math.min(clamp, v.y)) * radius;

    ctx.save();
    ctx.globalAlpha = visible ? 1 : 0.32;
    ctx.strokeStyle = markerColor(marker.label);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1;

    if (marker.style === 'hollow') {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (marker.style === 'cross') {
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y + 5);
      ctx.lineTo(x - 6, y + 5);
      ctx.closePath();
      ctx.stroke();
    }

    const dist = Math.hypot(x - center, y - center);
    let labelX = x;
    let labelY = y + 15;
    if (dist < 20) {
      labelY = y - 16;
    } else if (dist > radius * 0.82) {
      labelX = x - ((x - center) / dist) * 13;
      labelY = y - ((y - center) / dist) * 13;
    }
    ctx.fillText(marker.label, labelX, labelY);
    ctx.restore();
  }
}

function markerColor(label: string): string {
  if (label === 'MNV') return '#ffef8a';
  if (label === 'PRO') return '#ffffff';
  if (label === 'RET') return '#b8f6c4';
  return '#80c98f';
}
