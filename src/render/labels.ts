import { Vector3, type Camera } from 'three';

/**
 * Screen-space labels pinned to world points — crisp DOM text for map
 * markers (craft, node, apsides, bodies) at any zoom.
 */
export class Labels {
  private readonly root: HTMLElement;
  private readonly pool = new Map<string, HTMLElement>();
  private used = new Set<string>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    parent.appendChild(this.root);
  }

  /** Call once per frame before `put`s. */
  begin(): void {
    this.used = new Set();
  }

  /** Pin `text` to a render-space point; `cls` styles it (craft, node, apsis…). */
  put(id: string, world: Vector3, text: string, cls: string, camera: Camera): HTMLElement | null {
    camera.updateMatrixWorld();
    const p = world.clone().project(camera);
    if (p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    let el = this.pool.get(id);
    if (!el) {
      el = document.createElement('div');
      this.pool.set(id, el);
      this.root.appendChild(el);
    }
    el.className = `label ${cls}`;
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${((p.x + 1) / 2) * window.innerWidth}px, ${((1 - p.y) / 2) * window.innerHeight}px)`;
    el.style.display = '';
    this.used.add(id);
    return el;
  }

  /** Hide every label not `put` this frame. */
  end(): void {
    for (const [id, el] of this.pool) if (!this.used.has(id)) el.style.display = 'none';
  }

  /** Screen position (px) of a world point, for hit-testing. */
  static screen(world: Vector3, camera: Camera): { x: number; y: number } {
    const p = world.clone().project(camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }
}
