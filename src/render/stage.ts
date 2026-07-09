import {
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
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
  private readonly composer: EffectComposer;
  private readonly crtPass: ShaderPass;

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.005, 300_000);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

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
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render(elapsed: number): void {
    this.crtPass.uniforms.time.value = elapsed;
    this.composer.render();
  }
}
