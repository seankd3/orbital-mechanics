import { OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer, type Camera } from 'three';
import { VOID } from './palette';

/**
 * Renderer and the two cameras: a true-scale perspective chase camera and
 * a top-down orthographic map camera. No post-processing — clean vectors.
 */
export class Stage {
  readonly scene = new Scene();
  readonly renderer: WebGLRenderer;
  readonly chase: PerspectiveCamera;
  readonly map: OrthographicCamera;
  active: Camera;
  /** Map half-height in render units. */
  mapHalfHeight = 20;

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(VOID);
    container.appendChild(this.renderer.domElement);

    // 0.1 m to 10 billion km: logarithmic depth keeps it all ordered.
    this.chase = new PerspectiveCamera(50, 1, 1e-7, 1e7);
    this.map = new OrthographicCamera(-1, 1, 1, -1, 1e-3, 1e7);
    this.active = this.chase;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setMapHalfHeight(h: number): void {
    this.mapHalfHeight = h;
    this.updateMap();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.chase.aspect = w / h;
    this.chase.updateProjectionMatrix();
    this.updateMap();
  }

  private updateMap(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.mapHalfHeight;
    Object.assign(this.map, { top: h, bottom: -h, left: -h * aspect, right: h * aspect });
    this.map.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.active);
  }
}
