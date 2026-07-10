import {
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
  type Camera,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Subtle CRT finish: vignette + phosphor chromatic fringe. Scanlines are CSS. */
const CrtShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    void main() {
      vec2 centered = vUv - 0.5;
      float dist = dot(centered, centered);

      // Chromatic fringe grows toward the edges.
      vec2 shift = centered * dist * 0.06;
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      vec3 color = vec3(r, g, b);

      // Vignette.
      color *= 1.0 - dist * 0.9;

      // Faint slow flicker, like a tired tube.
      color *= 0.985 + 0.015 * sin(time * 9.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class Stage {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  /** Top-down orthographic camera for MAP mode. */
  readonly mapCamera: OrthographicCamera;
  private mapHalfHeight = 16;
  private readonly composer: EffectComposer;
  private readonly crtPass: ShaderPass;
  private readonly renderPass: RenderPass;

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.005, 300_000);
    this.mapCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 3_000_000);
    this.updateMapProjection();

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    const bloom = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.9, // strength
      0.55, // radius
      0.0, // threshold — everything glows a little, it's a phosphor tube
    );
    this.composer.addPass(bloom);

    this.crtPass = new ShaderPass(CrtShader);
    this.composer.addPass(this.crtPass);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.updateMapProjection();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** Which camera the frame renders through. */
  setActiveCamera(camera: Camera): void {
    this.renderPass.camera = camera;
  }

  /** Map zoom = world half-height of the orthographic view (render units). */
  setMapZoom(halfHeight: number): void {
    this.mapHalfHeight = Math.min(600, Math.max(3, halfHeight));
    this.updateMapProjection();
  }

  get mapZoom(): number {
    return this.mapHalfHeight;
  }

  private updateMapProjection(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.mapCamera.top = this.mapHalfHeight;
    this.mapCamera.bottom = -this.mapHalfHeight;
    this.mapCamera.left = -this.mapHalfHeight * aspect;
    this.mapCamera.right = this.mapHalfHeight * aspect;
    this.mapCamera.updateProjectionMatrix();
  }

  render(elapsed: number): void {
    this.crtPass.uniforms.time.value = elapsed;
    this.composer.render();
  }
}
